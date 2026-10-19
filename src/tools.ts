/**
 * The tools this server offers an MCP client. Each is one or two calls to the
 * Yacrum REST API, as the API key's member.
 *
 * ⚑ The customer's own AI does the thinking: `deal_context` returns everything
 * about a deal, and the model summarises it. This server only fetches.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { YacrumApiError, type YacrumClient } from './client.js';

type Json = unknown;
type Result = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

const ok = (data: Json): Result => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });

/** A refusal from Yacrum as the tool's answer, worded for the model to relay. */
const failed = (error: unknown): Result => {
  const text = error instanceof YacrumApiError
    ? `Yacrum refused (${error.status} ${error.code}): ${error.message}${error.details ? `\n${JSON.stringify(error.details)}` : ''}`
    : `The request to Yacrum failed: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: 'text', text }], isError: true };
};

const run = (work: () => Promise<Json>) => async (): Promise<Result> => {
  try {
    return ok(await work());
  } catch (error) {
    return failed(error);
  }
};

interface Me { workspace: { name: string; slug: string }; member: { id: string; name: string; role: string }; key: { scope: string } }
interface Stage { id: string; name: string; kind: 'open' | 'paused' | 'won' | 'lost'; position: number; defaultProbability: number | null }
interface Opportunity { id: string; name: string; companyName: string; stageName: string; stageKind: string; amount?: number; currency?: string; probability: number; expectedCloseDate?: string }

const ID = z.string().min(1);
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export function registerTools(server: McpServer, yacrum: YacrumClient): void {
  const me = () => yacrum.get<Me>('/me');

  server.registerTool('whoami', {
    title: 'Who am I in Yacrum',
    description: 'The Yacrum workspace this key opens, the member it acts as (and their role), whether it can write, and this month\'s API usage.',
    annotations: { readOnlyHint: true },
  }, run(() => me()));

  server.registerTool('search', {
    title: 'Search Yacrum',
    description: 'Find companies, contacts, opportunities and open leads whose name contains the text. Returns ids to use with the other tools.',
    inputSchema: { query: z.string().min(1).describe('Part of a name') },
    annotations: { readOnlyHint: true },
  }, async ({ query }) => run(async () => {
    const needle = query.toLowerCase();
    const [companies, contacts, opportunities, leads] = await Promise.all([
      yacrum.get<Array<{ id: string; name: string }>>('/companies', { search: query }),
      yacrum.get<Array<{ id: string; name: string; companyName?: string; email?: string }>>('/contacts', { search: query }),
      yacrum.get<Opportunity[]>('/opportunities', { limit: '2000' }),
      yacrum.get<Array<{ id: string; name?: string; email?: string; companyName?: string }>>('/leads'),
    ]);
    return {
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
      contacts: contacts.map((c) => ({ id: c.id, name: c.name, company: c.companyName, email: c.email })),
      opportunities: opportunities.filter((o) => o.name.toLowerCase().includes(needle) || o.companyName?.toLowerCase().includes(needle))
        .map((o) => ({ id: o.id, name: o.name, company: o.companyName, stage: o.stageName, amount: o.amount, currency: o.currency })),
      leads: leads.filter((l) => [l.name, l.email, l.companyName].some((v) => v?.toLowerCase().includes(needle)))
        .map((l) => ({ id: l.id, name: l.name, email: l.email, company: l.companyName })),
    };
  })());

  server.registerTool('list_companies', {
    title: 'List companies',
    description: 'The workspace\'s companies, optionally only those whose name contains `search`.',
    inputSchema: { search: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, async ({ search }) => run(() => yacrum.get('/companies', { search }))());

  server.registerTool('get_company', {
    title: 'Get a company',
    description: 'One company, with its addresses, counts and custom fields.',
    inputSchema: { companyId: ID },
    annotations: { readOnlyHint: true },
  }, async ({ companyId }) => run(() => yacrum.get(`/companies/${encodeURIComponent(companyId)}`))());

  server.registerTool('create_company', {
    title: 'Create a company',
    description: 'Create a company (Admin or Sales). Without a typeId it gets the workspace\'s first company type.',
    inputSchema: {
      name: z.string().min(1).max(200),
      typeId: z.string().optional().describe('One of the workspace\'s company types; see list_company_types'),
      websiteURL: z.string().url().optional(),
      currency: z.enum(['USD', 'CAD']).optional(),
    },
  }, async (input) => run(async () => {
    const typeId = input.typeId ?? (await yacrum.get<Array<{ id: string }>>('/company-types'))[0]?.id;
    return yacrum.post('/companies', { ...input, typeId });
  })());

  server.registerTool('list_company_types', {
    title: 'List company types',
    description: 'The workspace\'s company types, in its order.',
    annotations: { readOnlyHint: true },
  }, run(() => yacrum.get('/company-types')));

  server.registerTool('list_contacts', {
    title: 'List contacts',
    description: 'Contacts, optionally of one company or matching a name.',
    inputSchema: { companyId: z.string().optional(), search: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, async ({ companyId, search }) => run(() => yacrum.get('/contacts', { companyId, search }))());

  server.registerTool('create_contact', {
    title: 'Create a contact',
    description: 'Create a contact at a company (Admin, Sales or Sales Engineer).',
    inputSchema: {
      companyId: ID,
      name: z.string().min(1).max(200),
      email: z.string().email().optional(),
      title: z.string().optional(),
      officePhone: z.string().optional(),
      mobilePhone: z.string().optional(),
    },
  }, async (input) => run(() => yacrum.post('/contacts', input))());

  server.registerTool('list_opportunities', {
    title: 'List opportunities',
    description: 'Deals, optionally of one company or one sales person, and of some stage kinds (open, paused, won, lost).',
    inputSchema: {
      companyId: z.string().optional(),
      salesPersonId: z.string().optional(),
      kinds: z.array(z.enum(['open', 'paused', 'won', 'lost'])).optional(),
    },
    annotations: { readOnlyHint: true },
  }, async ({ companyId, salesPersonId, kinds }) => run(() => yacrum.get('/opportunities', {
    companyId, salesPersonId, kinds: kinds?.join(','), limit: '2000',
  }))());

  server.registerTool('create_opportunity', {
    title: 'Create an opportunity',
    description: 'Create a deal at a company with its primary contact (Admin or Sales). Without a stage it starts in the first open stage; without a sales person it is the key\'s member\'s.',
    inputSchema: {
      companyId: ID,
      primaryContactId: ID,
      name: z.string().min(1).max(200),
      stageId: z.string().optional().describe('An open stage id from get_pipeline'),
      probability: z.number().int().min(0).max(100).optional(),
      amount: z.number().nonnegative().optional(),
      expectedCloseDate: DAY.optional(),
      salesPersonId: z.string().optional(),
      description: z.string().optional(),
    },
  }, async (input) => run(async () => {
    const [{ member }, { stages }] = await Promise.all([me(), yacrum.get<{ stages: Stage[] }>('/pipeline')]);
    const stage = stages.find((s) => s.id === input.stageId) ?? stages.find((s) => s.kind === 'open');
    return yacrum.post('/opportunities', {
      ...input,
      stageId: stage?.id,
      salesPersonId: input.salesPersonId ?? member.id,
      probability: input.probability ?? stage?.defaultProbability ?? 10,
    });
  })());

  server.registerTool('update_opportunity', {
    title: 'Update an opportunity',
    description: 'Change a deal\'s name, description, probability, amount (not while a quote drives it), expected close or whether it is in the forecast.',
    inputSchema: {
      opportunityId: ID,
      name: z.string().optional(),
      description: z.string().optional(),
      probability: z.number().int().min(0).max(100).optional(),
      amount: z.number().nonnegative().optional(),
      expectedCloseDate: DAY.optional(),
      includeInForecast: z.boolean().optional(),
    },
  }, async ({ opportunityId, ...fields }) => run(() => yacrum.patch(`/opportunities/${encodeURIComponent(opportunityId)}`, fields))());

  server.registerTool('move_opportunity_stage', {
    title: 'Move an opportunity to a stage',
    description: 'Move a deal to one of the workspace\'s stages (ids from get_pipeline). A lost stage needs a lostReasonId (and competitorName when the reason asks); a paused stage needs a pauseReason.',
    inputSchema: {
      opportunityId: ID,
      stageId: ID,
      lostReasonId: z.string().optional(),
      competitorName: z.string().optional(),
      pauseReason: z.string().optional(),
      probability: z.number().int().min(0).max(100).optional(),
    },
  }, async ({ opportunityId, ...move }) => run(() => yacrum.post(`/opportunities/${encodeURIComponent(opportunityId)}/stage`, move))());

  server.registerTool('log_activity', {
    title: 'Log activity',
    description: 'Add a note to a company, contact, opportunity or lead: a call, a meeting, an email, a decision. It shows on the record\'s Activity tab.',
    inputSchema: {
      parentType: z.enum(['company', 'contact', 'opportunity', 'lead']),
      parentId: ID,
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(5000),
    },
  }, async (input) => run(() => yacrum.post('/notes', input))());

  server.registerTool('create_action_item', {
    title: 'Create an action item',
    description: 'A task for a member, optionally on a deal, company or contact, with a due date. Without an owner it is the key\'s member\'s.',
    inputSchema: {
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      ownerId: z.string().optional(),
      dueDate: DAY.optional(),
      opportunityId: z.string().optional(),
      companyId: z.string().optional(),
      contactId: z.string().optional(),
    },
  }, async (input) => run(async () => yacrum.post('/action-items', { ...input, ownerId: input.ownerId ?? (await me()).member.id }))());

  server.registerTool('get_pipeline', {
    title: 'Get the pipeline\'s stages',
    description: 'The workspace\'s stages in order, each with its kind (open, paused, won, lost) and default probability, and its lost reasons.',
    annotations: { readOnlyHint: true },
  }, run(() => yacrum.get('/pipeline')));

  server.registerTool('pipeline_summary', {
    title: 'Pipeline summary',
    description: 'Open deals by stage: how many and how much, in each currency, and the probability-weighted total. Optionally one sales person\'s.',
    inputSchema: { salesPersonId: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, async ({ salesPersonId }) => run(async () => {
    const [{ stages }, deals] = await Promise.all([
      yacrum.get<{ stages: Stage[] }>('/pipeline'),
      yacrum.get<Opportunity[]>('/opportunities', { kinds: 'open', salesPersonId, limit: '2000' }),
    ]);
    return summarisePipeline(stages, deals);
  })());

  server.registerTool('forecast', {
    title: 'Forecast',
    description: 'Bookings, billings and cash by month, before tax, from won deals and open deals in the forecast (Admin, Management, Sales).',
    inputSchema: { currency: z.enum(['USD', 'CAD']).optional() },
    annotations: { readOnlyHint: true },
  }, async ({ currency }) => run(() => yacrum.get('/forecast', { currency }))());

  server.registerTool('qualification_score', {
    title: 'Qualification score',
    description: 'A deal\'s qualification under the workspace\'s framework: each answer, the category and total scores, and its tier.',
    inputSchema: { opportunityId: ID },
    annotations: { readOnlyHint: true },
  }, async ({ opportunityId }) => run(() => yacrum.get(`/qualifications/${encodeURIComponent(opportunityId)}`))());

  server.registerTool('deal_context', {
    title: 'Deal context',
    description: 'Everything about one deal in one read, to summarise it: the deal, its company and contact, stage history, quotes, qualification, open action items, notes, recent activity, and whether you may edit it.',
    inputSchema: { opportunityId: ID },
    annotations: { readOnlyHint: true },
  }, async ({ opportunityId }) => run(() => yacrum.get(`/opportunities/${encodeURIComponent(opportunityId)}/context`))());

  server.registerPrompt('summarize_deal', {
    title: 'Summarise a deal',
    description: 'Read a deal\'s whole context from Yacrum and summarise where it stands and what to do next.',
    argsSchema: { opportunityId: z.string().describe('The opportunity\'s id; use search to find it') },
  }, ({ opportunityId }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Call deal_context for opportunity ${opportunityId}. Then summarise the deal: where it stands (stage, amount, probability, expected close), who is involved, what has happened recently, how well it is qualified, what is open, and the risks. End with the next steps you recommend.`,
      },
    }],
  }));
}

/** Open deals by stage, in pipeline order: counts, and totals kept per currency (never added across currencies). */
export function summarisePipeline(stages: Stage[], deals: Opportunity[]) {
  const open = stages.filter((s) => s.kind === 'open').sort((a, b) => a.position - b.position);
  const total = (list: Opportunity[], weighted = false) => list.reduce<Record<string, number>>((sum, deal) => {
    if (typeof deal.amount !== 'number') return sum;
    const currency = deal.currency ?? 'USD';
    sum[currency] = (sum[currency] ?? 0) + (weighted ? (deal.amount * deal.probability) / 100 : deal.amount);
    return sum;
  }, {});
  return {
    openDeals: deals.length,
    total: total(deals),
    weighted: total(deals, true),
    byStage: open.map((stage) => {
      const inStage = deals.filter((deal) => deal.stageName === stage.name);
      return { stage: stage.name, deals: inStage.length, total: total(inStage) };
    }),
  };
}
