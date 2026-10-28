import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { YacrumClient } from '../src/client.js';
import { registerTools, summarisePipeline } from '../src/tools.js';

const KEY = `yk_${'a'.repeat(40)}`;
type Call = { method: string; url: URL; headers: Record<string, string>; body?: unknown };

/** A fake Yacrum: answers by path, and remembers every call. */
function fakeYacrum(routes: Record<string, (call: Call) => { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const fetcher = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    const call: Call = {
      method: init?.method ?? 'GET', url, headers: init?.headers as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const route = routes[`${call.method} ${url.pathname.replace('/api/v1', '')}`];
    const answer = route ? route(call) : { status: 404, body: { error: { code: 'not_found', message: 'No such route' } } };
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  }) as typeof fetch;
  return { calls, fetcher };
}

async function connect(fetcher: typeof fetch) {
  const server = new McpServer({ name: 'yacrum', version: 'test' });
  registerTools(server, new YacrumClient({ baseUrl: 'https://crm.example.com/', apiKey: KEY }, fetcher));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(clientSide);
  return client;
}

const text = (result: unknown) => (result as { content: Array<{ text: string }> }).content[0].text;

const ME = { workspace: { name: 'Acme', slug: 'acme' }, member: { id: 'u1', name: 'Sam', role: 'Sales' }, key: { scope: 'write' } };
const STAGES = { stages: [
  { id: 's-lead', name: 'Lead', kind: 'open', position: 1, defaultProbability: 10 },
  { id: 's-prop', name: 'Proposal', kind: 'open', position: 2, defaultProbability: 50 },
  { id: 's-won', name: 'Won', kind: 'won', position: 9, defaultProbability: 100 },
], lostReasons: [] };

describe('the Yacrum MCP server', () => {
  let yacrum: ReturnType<typeof fakeYacrum>;
  beforeEach(() => {
    yacrum = fakeYacrum({
      'GET /me': () => ({ body: { data: ME } }),
      'GET /pipeline': () => ({ body: { data: STAGES } }),
      'GET /company-types': () => ({ body: { data: [{ id: 't-customer', name: 'Customer' }] } }),
      'POST /companies': () => ({ status: 201, body: { data: { id: 'c1' } } }),
      'POST /opportunities': () => ({ status: 201, body: { data: { id: 'o1' } } }),
      'POST /notes': () => ({ status: 201, body: { data: { id: 'n1' } } }),
      'GET /opportunities/o1/context': () => ({ body: { data: { opportunity: { id: 'o1', name: 'Pilot' }, canEdit: true } } }),
      'POST /opportunities/o1/stage': () => ({ status: 400, body: { error: { code: 'validation_error', message: 'Choose a lost reason' } } }),
    });
  });

  it('offers the tools a deal needs, and the summarise prompt', async () => {
    const client = await connect(yacrum.fetcher);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([
      'whoami', 'search', 'create_company', 'create_contact', 'create_opportunity', 'move_opportunity_stage',
      'log_activity', 'pipeline_summary', 'forecast', 'qualification_score', 'deal_context',
    ]));
    expect((await client.listPrompts()).prompts.map((p) => p.name)).toContain('summarize_deal');
  });

  it('calls Yacrum with the key, as Bearer, and nothing else', async () => {
    const client = await connect(yacrum.fetcher);
    expect(JSON.parse(text(await client.callTool({ name: 'whoami', arguments: {} })))).toEqual(ME);
    expect(yacrum.calls[0].url.href).toBe('https://crm.example.com/api/v1/me');
    expect(yacrum.calls[0].headers.authorization).toBe(`Bearer ${KEY}`);
  });

  it('creates a company in the first company type when none is named', async () => {
    const client = await connect(yacrum.fetcher);
    await client.callTool({ name: 'create_company', arguments: { name: 'Northwind' } });
    expect(yacrum.calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Northwind', typeId: 't-customer' });
  });

  it('creates a deal in the first open stage, at its default probability, for the key’s member', async () => {
    const client = await connect(yacrum.fetcher);
    await client.callTool({ name: 'create_opportunity', arguments: { companyId: 'c1', primaryContactId: 'p1', name: 'Pilot' } });
    expect(yacrum.calls.find((c) => c.method === 'POST')?.body).toEqual({
      companyId: 'c1', primaryContactId: 'p1', name: 'Pilot', stageId: 's-lead', salesPersonId: 'u1', probability: 10,
    });
  });

  it('logs activity as a note on the record, and reads a deal’s whole context', async () => {
    const client = await connect(yacrum.fetcher);
    await client.callTool({ name: 'log_activity', arguments: { parentType: 'opportunity', parentId: 'o1', title: 'Call', description: 'Agreed the pilot.' } });
    expect(yacrum.calls.at(-1)?.body).toEqual({ parentType: 'opportunity', parentId: 'o1', title: 'Call', description: 'Agreed the pilot.' });
    const context = JSON.parse(text(await client.callTool({ name: 'deal_context', arguments: { opportunityId: 'o1' } })));
    expect(context).toMatchObject({ opportunity: { name: 'Pilot' }, canEdit: true });
  });

  it('sets Sales Health with its note in one change, and refuses a status with no note', async () => {
    yacrum = fakeYacrum({ 'PATCH /opportunities/o1': () => ({ body: { data: { id: 'o1', status: 'Y' } } }) });
    const client = await connect(yacrum.fetcher);
    const result = await client.callTool({ name: 'set_sales_health', arguments: { opportunityId: 'o1', status: 'Y', note: 'Champion left' } });
    expect(result.isError).toBeFalsy();
    expect(yacrum.calls).toHaveLength(1);
    expect(yacrum.calls[0].method).toBe('PATCH');
    expect(yacrum.calls[0].body).toEqual({ status: 'Y', statusDescription: 'Champion left' });

    const noNote = await client.callTool({ name: 'set_sales_health', arguments: { opportunityId: 'o1', status: 'R', note: ' ' } });
    expect(noNote.isError).toBe(true);
    expect(yacrum.calls).toHaveLength(1);
  });

  it('scores an opportunity with PUT, naming the template as frameworkId, and reads the templates and the gates', async () => {
    yacrum = fakeYacrum({
      'GET /scoring-templates': () => ({ body: { data: [{ id: 't1', name: 'Opportunity Score', isDefault: true }] } }),
      'PUT /qualifications/o1': () => ({ body: { data: { id: 'o1', percent: 72.5 } } }),
      'GET /opportunities/o1/gates': () => ({ body: { data: { stages: [], readyFor: { stageId: 's2', stageName: 'Qualified' } } } }),
    });
    const client = await connect(yacrum.fetcher);
    await client.callTool({ name: 'list_scoring_templates', arguments: {} });
    expect(yacrum.calls[0]).toMatchObject({ method: 'GET' });
    const scored = await client.callTool({ name: 'score_opportunity', arguments: { opportunityId: 'o1', templateId: 't2', answers: { q1: 7, q2: 'opt-1', q3: null } } });
    expect(scored.isError).toBeFalsy();
    expect(yacrum.calls[1]).toMatchObject({ method: 'PUT', body: { frameworkId: 't2', answers: { q1: 7, q2: 'opt-1', q3: null } } });
    await client.callTool({ name: 'score_opportunity', arguments: { opportunityId: 'o1', answers: { q1: 8 } } });
    expect(yacrum.calls[2].body).toEqual({ answers: { q1: 8 } });
    const ready = await client.callTool({ name: 'stage_readiness', arguments: { opportunityId: 'o1' } });
    expect(JSON.parse(text(ready)).readyFor.stageName).toBe('Qualified');
  });

  it('sends an override reason as override, and passes a 409 stage_gate through with what is unmet', async () => {
    const unmet = [{ kind: 'quote', stageName: 'Pre-SOW', now: null }];
    yacrum = fakeYacrum({
      'POST /opportunities/o1/stage': (call) => ((call.body as { override?: unknown }).override
        ? { body: { data: { id: 'o1' } } }
        : { status: 409, body: { error: { code: 'stage_gate', message: 'Pre-SOW needs: a sent quote (there is no quote).', details: { unmet } } } }),
    });
    const client = await connect(yacrum.fetcher);
    const refused = await client.callTool({ name: 'move_opportunity_stage', arguments: { opportunityId: 'o1', stageId: 's3' } });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toContain('409 stage_gate');
    expect(text(refused)).toContain('"stageName":"Pre-SOW"');
    const moved = await client.callTool({ name: 'move_opportunity_stage', arguments: { opportunityId: 'o1', stageId: 's3', overrideReason: 'Quote is with legal' } });
    expect(moved.isError).toBeFalsy();
    expect(yacrum.calls[1].body).toEqual({ stageId: 's3', override: { reason: 'Quote is with legal' } });
  });

  it('relays Yacrum’s refusal as a tool error the model can read', async () => {
    const client = await connect(yacrum.fetcher);
    const result = await client.callTool({ name: 'move_opportunity_stage', arguments: { opportunityId: 'o1', stageId: 's-lost' } });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Yacrum refused (400 validation_error): Choose a lost reason');
  });
});

describe('the signals, outreach, quote, action-item and pipeline-changes tools (#360)', () => {
  const SIGNAL = 'quote.quiet:00000000-0000-4000-8000-000000000001';
  let yacrum: ReturnType<typeof fakeYacrum>;
  beforeEach(() => {
    yacrum = fakeYacrum({
      'GET /signals': () => ({ body: { data: { signals: [{ id: SIGNAL }], nextCursor: null } } }),
      [`POST /signals/${encodeURIComponent(SIGNAL)}/snooze`]: (call) => ({ body: { data: { id: SIGNAL, until: (call.body as { until: string }).until } } }),
      [`DELETE /signals/${encodeURIComponent(SIGNAL)}/snooze`]: () => ({ body: { data: { id: SIGNAL, removed: true } } }),
      'GET /workspace/outreach': () => ({ body: { data: { bccAddress: 'acme.k3x9@in.yacrum.com', styleGuide: 'Brief.' } } }),
      'GET /quotes': () => ({ body: { data: [{ id: 'q1' }] } }),
      'GET /quotes/q1': () => ({ body: { data: { id: 'q1' } } }),
      'GET /action-items': () => ({ body: { data: [] } }),
      'PATCH /action-items/a1': () => ({ body: { data: { id: 'a1', status: 'Completed' } } }),
      'GET /pipeline/changes': () => ({ status: 429, body: { error: { code: 'plan_limit', message: 'This workspace has used its API calls for the month.', details: { limit: 1000 } } } }),
    });
  });

  it('reads the signals with the query Yacrum expects', async () => {
    const client = await connect(yacrum.fetcher);
    const result = JSON.parse(text(await client.callTool({ name: 'get_signals', arguments: {
      scope: 'team', salesPersonId: 'u2', types: ['quote.quiet', 'deal.stale'], limit: 10, includeSnoozed: true,
    } })));
    expect(result.signals[0].id).toBe(SIGNAL);
    const url = yacrum.calls[0].url;
    expect(url.pathname).toBe('/api/v1/signals');
    expect(Object.fromEntries(url.searchParams)).toEqual({ scope: 'team', salesPersonId: 'u2', types: 'quote.quiet,deal.stale', limit: '10', includeSnoozed: 'true' });
  });

  it('snoozes and unsnoozes a signal by its id', async () => {
    const client = await connect(yacrum.fetcher);
    expect(JSON.parse(text(await client.callTool({ name: 'snooze_signal', arguments: { signalId: SIGNAL, until: '2026-11-01' } }))))
      .toEqual({ id: SIGNAL, until: '2026-11-01' });
    expect(yacrum.calls[0]).toMatchObject({ method: 'POST', body: { until: '2026-11-01' } });
    expect(JSON.parse(text(await client.callTool({ name: 'unsnooze_signal', arguments: { signalId: SIGNAL } })))).toEqual({ id: SIGNAL, removed: true });
    expect(yacrum.calls[1].method).toBe('DELETE');
  });

  it('reads the outreach settings, the quotes and the action items, and completes an item', async () => {
    const client = await connect(yacrum.fetcher);
    expect(JSON.parse(text(await client.callTool({ name: 'get_outreach_settings', arguments: {} })))).toEqual({ bccAddress: 'acme.k3x9@in.yacrum.com', styleGuide: 'Brief.' });
    await client.callTool({ name: 'list_quotes', arguments: { opportunityId: 'o1' } });
    expect(yacrum.calls.at(-1)!.url.searchParams.get('opportunityId')).toBe('o1');
    await client.callTool({ name: 'get_quote', arguments: { quoteId: 'q1' } });
    await client.callTool({ name: 'list_action_items', arguments: { ownerId: 'u1', overdue: true } });
    expect(Object.fromEntries(yacrum.calls.at(-1)!.url.searchParams)).toEqual({ ownerId: 'u1', overdue: 'true' });
    await client.callTool({ name: 'update_action_item', arguments: { actionItemId: 'a1', status: 'Completed' } });
    expect(yacrum.calls.at(-1)).toMatchObject({ method: 'PATCH', body: { status: 'Completed' } });
  });

  it('passes a plan limit through as a tool error, with its details', async () => {
    const client = await connect(yacrum.fetcher);
    const result = await client.callTool({ name: 'pipeline_changes', arguments: { since: '2026-10-16', scope: 'mine' } });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Yacrum refused (429 plan_limit): This workspace has used its API calls for the month.\n{"limit":1000}');
  });

  it('tells the client what every tool does, so it can ask before a write', async () => {
    const client = await connect(yacrum.fetcher);
    const tools = Object.fromEntries((await client.listTools()).tools.map((t) => [t.name, t.annotations ?? {}]));
    const reads = ['whoami', 'search', 'list_companies', 'get_company', 'list_company_types', 'list_contacts', 'list_opportunities',
      'get_pipeline', 'pipeline_summary', 'forecast', 'qualification_score', 'deal_context', 'get_signals', 'get_outreach_settings',
      'list_quotes', 'get_quote', 'list_action_items', 'pipeline_changes', 'list_scoring_templates', 'stage_readiness'];
    for (const name of reads) expect([name, tools[name]]).toEqual([name, { readOnlyHint: true }]);
    for (const name of ['create_company', 'create_contact', 'create_opportunity', 'log_activity', 'create_action_item']) {
      expect([name, tools[name]]).toEqual([name, { readOnlyHint: false, destructiveHint: false }]);
    }
    for (const name of ['update_opportunity', 'set_sales_health', 'update_action_item', 'snooze_signal', 'unsnooze_signal']) {
      expect([name, tools[name]]).toEqual([name, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }]);
    }
    expect(tools.move_opportunity_stage).toEqual({ readOnlyHint: false, destructiveHint: true });
    // ⚑ Scoring on another template deletes the old answers.
    expect(tools.score_opportunity).toEqual({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
    // Every tool is in one of the lists above: none is left unannotated.
    expect(Object.keys(tools)).toHaveLength(reads.length + 5 + 5 + 1 + 1);
  });
});

describe('the pipeline summary', () => {
  it('counts open deals by stage in order, and never adds two currencies together', () => {
    const summary = summarisePipeline(STAGES.stages as never, [
      { id: '1', name: 'A', companyName: 'X', stageName: 'Lead', stageKind: 'open', amount: 1000, currency: 'USD', probability: 10 },
      { id: '2', name: 'B', companyName: 'Y', stageName: 'Proposal', stageKind: 'open', amount: 2000, currency: 'CAD', probability: 50 },
    ]);
    expect(summary).toEqual({
      openDeals: 2, total: { USD: 1000, CAD: 2000 }, weighted: { USD: 100, CAD: 1000 },
      byStage: [{ stage: 'Lead', deals: 1, total: { USD: 1000 } }, { stage: 'Proposal', deals: 1, total: { CAD: 2000 } }],
    });
  });
});
