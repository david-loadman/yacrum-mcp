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

  it('relays Yacrum’s refusal as a tool error the model can read', async () => {
    const client = await connect(yacrum.fetcher);
    const result = await client.callTool({ name: 'move_opportunity_stage', arguments: { opportunityId: 'o1', stageId: 's-lost' } });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe('Yacrum refused (400 validation_error): Choose a lost reason');
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
