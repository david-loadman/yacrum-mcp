import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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
      body: init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const route = routes[`${call.method} ${url.pathname.replace('/api/v1', '')}`];
    const answer = route ? route(call) : { status: 404, body: { error: { code: 'not_found', message: 'No such route' } } };
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
  }) as typeof fetch;
  return { calls, fetcher };
}

async function connect(fetcher: typeof fetch, importCallMs?: number) {
  const server = new McpServer({ name: 'yacrum', version: 'test' });
  registerTools(server, new YacrumClient({ baseUrl: 'https://crm.example.com/', apiKey: KEY }, fetcher), importCallMs);
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
      'list_quotes', 'get_quote', 'list_action_items', 'pipeline_changes', 'list_scoring_templates', 'stage_readiness',
      'list_profiles', 'get_workspace_setup', 'get_import_templates', 'get_import_status'];
    for (const name of reads) expect([name, tools[name]]).toEqual([name, { readOnlyHint: true }]);
    for (const name of ['create_company', 'create_contact', 'create_opportunity', 'log_activity', 'create_action_item']) {
      expect([name, tools[name]]).toEqual([name, { readOnlyHint: false, destructiveHint: false }]);
    }
    for (const name of ['update_opportunity', 'set_sales_health', 'update_action_item', 'snooze_signal', 'unsnooze_signal']) {
      expect([name, tools[name]]).toEqual([name, { readOnlyHint: false, destructiveHint: false, idempotentHint: true }]);
    }
    expect(tools.preview_import).toEqual({ readOnlyHint: false, destructiveHint: false });
    expect(tools.set_workspace_features).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    for (const name of ['move_opportunity_stage', 'apply_profile', 'import_records', 'undo_import']) {
      expect([name, tools[name]]).toEqual([name, { readOnlyHint: false, destructiveHint: true }]);
    }
    // ⚑ Scoring on another template deletes the old answers.
    expect(tools.score_opportunity).toEqual({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
    // Every tool is in one of the lists above: none is left unannotated.
    expect(Object.keys(tools)).toHaveLength(reads.length + 5 + 5 + 4 + 1 + 2);
  });
});

describe('the setup and import tools (#405)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yacrum-mcp-'));
  const file = (name: string, content = 'name\nAcme\n') => { const path = join(dir, name); writeFileSync(path, content); return path; };
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const ANSWERS = { summary: { id: 'i1', status: 'uploaded' }, next: 'answers', setup: { mapping: { stages: {} }, stageSuggestions: {} } };
  const PREVIEW = { counts: { companies: 2 }, duplicates: [], held: [], canadianContacts: 1, suggestCasl: true };
  const importRoutes = (overrides: Parameters<typeof fakeYacrum>[0] = {}) => fakeYacrum({
    'POST /imports': () => ({ status: 201, body: { data: { id: 'i1', status: 'uploaded', unrecognised: ['notes.csv'] } } }),
    'GET /imports/i1': () => ({ body: { data: ANSWERS } }),
    'GET /imports/i1/preview': () => ({ body: { data: PREVIEW } }),
    'POST /imports/i1/answers': () => ({ body: { data: { saved: ['mapping'] } } }),
    ...overrides,
  });
  const NOTHING_SAVED = { status: 409, body: { error: { code: 'invalid_state', message: 'Save the answers first.' } } };

  it('⛔ tells the model where product types and column refs come from, so it does not guess them (#470)', async () => {
    const client = await connect(importRoutes().fetcher);
    const description = (await client.listTools()).tools.find((t) => t.name === 'preview_import')?.description ?? '';
    expect(description).toMatch(/one of setup\.options\.skuTypes, exactly as written there/);
    expect(description).toMatch(/keyed by a column's ref from setup\.survey\.offered .*never its header/);
    expect(description).toMatch(/preview\.needsRate .*mapping\.usdCadRate/);
    expect(description).toMatch(/preview\.needsContact.*mapping\.contactsToAdd.*Never invent a contact or a rate/);
  });

  it('reads the setup, the Profiles and the templates, and shows or hides a feature', async () => {
    const { calls, fetcher } = fakeYacrum({
      'GET /profiles': () => ({ body: { data: [{ key: 'product_seller' }] } }),
      'GET /workspace/setup': () => ({ body: { data: { onboarding: { status: 'not_started' } } } }),
      'GET /imports/templates': () => ({ body: { data: { spreadsheet: [], exports: {} } } }),
      'PATCH /workspace/features': () => ({ body: { data: { hidden: ['quotes'] } } }),
    });
    const client = await connect(fetcher);
    expect(text(await client.callTool({ name: 'list_profiles', arguments: {} }))).toContain('product_seller');
    expect(text(await client.callTool({ name: 'get_workspace_setup', arguments: {} }))).toContain('not_started');
    expect(text(await client.callTool({ name: 'get_import_templates', arguments: {} }))).toContain('spreadsheet');
    await client.callTool({ name: 'set_workspace_features', arguments: { quotes: false } });
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { quotes: false } });
  });

  it('will not apply a Profile unless dryRun is said, and sends what it was given', async () => {
    const { calls, fetcher } = fakeYacrum({ 'POST /workspace/profile': () => ({ body: { data: { applied: false, defaulted: true } } }) });
    const client = await connect(fetcher);
    const refused = await client.callTool({ name: 'apply_profile', arguments: { profileKey: 'var_si', templateMode: 'install_default' } });
    expect(refused.isError).toBe(true);
    expect(calls).toHaveLength(0);

    await client.callTool({ name: 'apply_profile', arguments: { profileKey: 'var_si', templateMode: 'install_default', dryRun: true, featureChanges: { casl: true } } });
    expect(calls[0]).toMatchObject({ method: 'POST', body: { profileKey: 'var_si', dryRun: true, featureChanges: { casl: true } } });
  });

  it('uploads the files as multipart with the source, and says what is asked next', async () => {
    const { calls, fetcher } = importRoutes({ 'GET /imports/i1/preview': () => NOTHING_SAVED });
    const client = await connect(fetcher);
    const result = await client.callTool({ name: 'preview_import', arguments: { files: [file('deals.csv', 'id,name\n1,Big\n')], source: 'hubspot' } });
    const form = calls[0].body as FormData;
    expect(calls[0].url.pathname).toBe('/api/v1/imports');
    expect(calls[0].headers['content-type']).toBeUndefined();
    expect(form.get('source')).toBe('hubspot');
    const sent = form.getAll('files') as File[];
    expect(sent.map((f) => f.name)).toEqual(['deals.csv']);
    expect(await sent[0].text()).toBe('id,name\n1,Big\n');
    expect(JSON.parse(text(result))).toMatchObject({ id: 'i1', next: 'answers', unrecognised: ['notes.csv'], preview: null, previewNote: 'Save the answers first.' });
  });

  it('refuses a file it should not read before anything is read or sent', async () => {
    const { calls, fetcher } = importRoutes();
    const client = await connect(fetcher);
    const secret = file('id_rsa', 'PRIVATE');
    const link = join(dir, 'looks-fine.csv');
    symlinkSync(secret, link);
    const big = file('big.csv');
    truncateSync(big, 10 * 1024 * 1024 + 1);
    const parts = ['a', 'b', 'c'].map((n) => { const path = file(`${n}.csv`); truncateSync(path, 9 * 1024 * 1024); return path; });

    const refusals: Array<[string[], string]> = [
      [[secret], 'not an Excel'],
      [[link], 'not a regular file'],
      [[file('old.xls')], 'not an Excel'],
      [['deals.csv'], 'not a full path'],
      [[join(dir, 'missing.csv')], 'not found'],
      [[big], 'larger than 10 MB'],
      [parts, 'larger than 25 MB'],
      [Array.from({ length: 13 }, () => file('one.csv')), 'at most 12'],
    ];
    for (const [files, why] of refusals) {
      const result = await client.callTool({ name: 'preview_import', arguments: { files, source: 'spreadsheet' } });
      expect(result.isError).toBe(true);
      expect(text(result)).toContain(`Nothing was sent to Yacrum: `);
      expect(text(result)).toContain(why);
      expect(text(result)).not.toContain('PRIVATE');
    }
    expect(calls).toHaveLength(0);
  });

  it('needs a source with files, and files or an import', async () => {
    const { calls, fetcher } = importRoutes();
    const client = await connect(fetcher);
    expect((await client.callTool({ name: 'preview_import', arguments: { files: [file('a.csv')] } })).isError).toBe(true);
    expect((await client.callTool({ name: 'preview_import', arguments: {} })).isError).toBe(true);
    expect((await client.callTool({ name: 'preview_import', arguments: { files: [file('a.csv')], source: 'hubspot', importId: 'i1' } })).isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('saves the answers, then previews them', async () => {
    const { calls, fetcher } = importRoutes();
    const client = await connect(fetcher);
    const mapping = { stages: { Lead: 's1' }, duplicates: { g1: true } };
    const result = await client.callTool({ name: 'preview_import', arguments: { importId: 'i1', mapping } });
    expect(calls[0]).toMatchObject({ method: 'POST', body: { mapping } });
    expect(calls[0].url.pathname).toBe('/api/v1/imports/i1/answers');
    expect(JSON.parse(text(result)).preview).toEqual(PREVIEW);
  });

  it('passes on what is wrong with the answers, and answers that have gone stale', async () => {
    const refused = importRoutes({ 'POST /imports/i1/answers': () => ({ status: 400, body: { error: { code: 'validation_error', message: 'These answers need changing.', details: { problems: ['No such stage'] } } } }) });
    const failed = await (await connect(refused.fetcher)).callTool({ name: 'preview_import', arguments: { importId: 'i1', mapping: {} } });
    expect(failed.isError).toBe(true);
    expect(text(failed)).toContain('No such stage');

    const stale = importRoutes({ 'GET /imports/i1/preview': () => ({ status: 409, body: { error: { code: 'invalid_state', message: 'These answers need changing.', details: { problems: ['A stage has gone'] } } } }) });
    const view = JSON.parse(text(await (await connect(stale.fetcher)).callTool({ name: 'preview_import', arguments: { importId: 'i1' } })));
    expect(view).toMatchObject({ preview: null, previewProblems: { problems: ['A stage has gone'] } });
  });

  it('does not preview an import past its answers', async () => {
    const { calls, fetcher } = importRoutes({ 'GET /imports/i1': () => ({ body: { data: { summary: {}, next: 'none', totals: { done: 2 } } } }) });
    const view = JSON.parse(text(await (await connect(fetcher)).callTool({ name: 'preview_import', arguments: { importId: 'i1' } })));
    expect(view.next).toBe('none');
    expect(calls.map((c) => c.url.pathname)).toEqual(['/api/v1/imports/i1']);
  });

  it('runs an import until it finishes', async () => {
    const answers = ['running', 'running', 'completed'];
    const { calls, fetcher } = importRoutes({ 'POST /imports/i1/run': () => ({ body: { data: { status: answers.shift(), total: 3, done: 3, failed: 0 } } }) });
    const view = JSON.parse(text(await (await connect(fetcher)).callTool({ name: 'import_records', arguments: { importId: 'i1' } })));
    expect(calls).toHaveLength(3);
    expect(view).toMatchObject({ status: 'completed', done: 3, more: false });
  });

  it('hands back an import still running once its time is up, and passes on a refusal', async () => {
    const running = importRoutes({ 'POST /imports/i1/run': () => ({ body: { data: { status: 'running', total: 9, done: 1, failed: 0 } } }) });
    const view = JSON.parse(text(await (await connect(running.fetcher, 0)).callTool({ name: 'import_records', arguments: { importId: 'i1' } })));
    expect(running.calls).toHaveLength(1);
    expect(view).toMatchObject({ status: 'running', more: true });

    const limited = importRoutes({ 'POST /imports/i1/run': () => ({ status: 429, body: { error: { code: 'plan_limit', message: 'The month is used up.' } } }) });
    const refused = await (await connect(limited.fetcher)).callTool({ name: 'import_records', arguments: { importId: 'i1' } });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toContain('plan_limit');
  });

  it('reads an import’s status, and undoes it or says what stands in the way', async () => {
    const { calls, fetcher } = importRoutes({ 'POST /imports/i1/undo': () => ({ status: 409, body: { error: { code: 'invalid_state', message: 'A contact hangs off it.' } } }) });
    const client = await connect(fetcher);
    expect(JSON.parse(text(await client.callTool({ name: 'get_import_status', arguments: { importId: 'i1' } }))).next).toBe('answers');
    const refused = await client.callTool({ name: 'undo_import', arguments: { importId: 'i1' } });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toContain('A contact hangs off it');
    expect(calls.at(-1)?.method).toBe('POST');
  });

  it('never echoes the key, whether Yacrum answers or refuses', async () => {
    const answering = importRoutes({
      'GET /profiles': () => ({ body: { data: [] } }), 'GET /workspace/setup': () => ({ body: { data: {} } }),
      'POST /workspace/profile': () => ({ body: { data: {} } }), 'PATCH /workspace/features': () => ({ body: { data: {} } }),
      'GET /imports/templates': () => ({ body: { data: {} } }), 'POST /imports/i1/run': () => ({ body: { data: { status: 'completed' } } }),
      'POST /imports/i1/undo': () => ({ body: { data: {} } }),
    });
    const refusing = fakeYacrum({});
    for (const fetcher of [answering.fetcher, refusing.fetcher]) {
      const client = await connect(fetcher);
      const profile = { profileKey: 'var_si', templateMode: 'keep_current', dryRun: true };
      const calls: Array<[string, Record<string, unknown>]> = [
        ['list_profiles', {}], ['get_workspace_setup', {}], ['apply_profile', profile], ['set_workspace_features', { casl: true }],
        ['get_import_templates', {}], ['preview_import', { files: [file('a.csv')], source: 'hubspot' }], ['preview_import', { importId: 'i1' }],
        ['import_records', { importId: 'i1' }], ['get_import_status', { importId: 'i1' }], ['undo_import', { importId: 'i1' }],
      ];
      for (const [name, args] of calls) expect(JSON.stringify(await client.callTool({ name, arguments: args }))).not.toContain(KEY);
    }
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
