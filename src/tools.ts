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

/**
 * How each tool tells the client what it does, so the client can ask before a
 * write (#360). A read changes nothing; an additive write makes a record and
 * destroys none; an update changes a record and doing it twice is the same as
 * once; a stage move is consequential — a lost or paused stage records a reason
 * and changes the forecast.
 */
const READ = { readOnlyHint: true } as const;
const ADDS = { readOnlyHint: false, destructiveHint: false } as const;
const UPDATES = { readOnlyHint: false, destructiveHint: false, idempotentHint: true } as const;
const CONSEQUENTIAL = { readOnlyHint: false, destructiveHint: true } as const;

const SIGNAL_TYPES = [
  'deal.stale', 'deal.slipping', 'deal.no_next_step', 'quote.quiet', 'quote.expiring',
  'deal.lost_revisit', 'deal.paused_revisit', 'account.dormant', 'account.renewal', 'contact.referral',
] as const;

const ID = z.string().min(1);
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export function registerTools(server: McpServer, yacrum: YacrumClient): void {
  const me = () => yacrum.get<Me>('/me');

  server.registerTool('whoami', {
    title: 'Who am I in Yacrum',
    description: 'The Yacrum workspace this key opens, the member it acts as (and their role), whether it can write, and this month\'s API usage.',
    annotations: READ,
  }, run(() => me()));

  server.registerTool('search', {
    title: 'Search Yacrum',
    description: 'Find companies, contacts, opportunities and open leads whose name contains the text. Returns ids to use with the other tools.',
    inputSchema: { query: z.string().min(1).describe('Part of a name') },
    annotations: READ,
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
    annotations: READ,
  }, async ({ search }) => run(() => yacrum.get('/companies', { search }))());

  server.registerTool('get_company', {
    title: 'Get a company',
    description: 'One company, with its addresses, counts and custom fields.',
    inputSchema: { companyId: ID },
    annotations: READ,
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
    annotations: ADDS,
  }, async (input) => run(async () => {
    const typeId = input.typeId ?? (await yacrum.get<Array<{ id: string }>>('/company-types'))[0]?.id;
    return yacrum.post('/companies', { ...input, typeId });
  })());

  server.registerTool('list_company_types', {
    title: 'List company types',
    description: 'The workspace\'s company types, in its order.',
    annotations: READ,
  }, run(() => yacrum.get('/company-types')));

  server.registerTool('list_contacts', {
    title: 'List contacts',
    description: 'Contacts, optionally of one company or matching a name.',
    inputSchema: { companyId: z.string().optional(), search: z.string().optional() },
    annotations: READ,
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
    annotations: ADDS,
  }, async (input) => run(() => yacrum.post('/contacts', input))());

  server.registerTool('list_opportunities', {
    title: 'List opportunities',
    description: 'Deals, optionally of one company or one sales person, and of some stage kinds (open, paused, won, lost).',
    inputSchema: {
      companyId: z.string().optional(),
      salesPersonId: z.string().optional(),
      kinds: z.array(z.enum(['open', 'paused', 'won', 'lost'])).optional(),
    },
    annotations: READ,
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
    annotations: ADDS,
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
    annotations: UPDATES,
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
    annotations: CONSEQUENTIAL,
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
    annotations: ADDS,
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
    annotations: ADDS,
  }, async (input) => run(async () => yacrum.post('/action-items', { ...input, ownerId: input.ownerId ?? (await me()).member.id }))());

  server.registerTool('get_pipeline', {
    title: 'Get the pipeline\'s stages',
    description: 'The workspace\'s stages in order, each with its kind (open, paused, won, lost) and default probability, and its lost reasons.',
    annotations: READ,
  }, run(() => yacrum.get('/pipeline')));

  server.registerTool('pipeline_summary', {
    title: 'Pipeline summary',
    description: 'Open deals by stage: how many and how much, in each currency, and the probability-weighted total. Optionally one sales person\'s.',
    inputSchema: { salesPersonId: z.string().optional() },
    annotations: READ,
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
    annotations: READ,
  }, async ({ currency }) => run(() => yacrum.get('/forecast', { currency }))());

  server.registerTool('qualification_score', {
    title: 'Qualification score',
    description: 'A deal\'s qualification under the workspace\'s framework: each answer, the category and total scores, and its tier.',
    inputSchema: { opportunityId: ID },
    annotations: READ,
  }, async ({ opportunityId }) => run(() => yacrum.get(`/qualifications/${encodeURIComponent(opportunityId)}`))());

  server.registerTool('deal_context', {
    title: 'Deal context',
    description: 'Everything about one deal in one read, to summarise it: the deal, its company and contact, stage history, quotes, qualification, open action items, notes, recent activity, and whether you may edit it.',
    inputSchema: { opportunityId: ID },
    annotations: READ,
  }, async ({ opportunityId }) => run(() => yacrum.get(`/opportunities/${encodeURIComponent(opportunityId)}/context`))());

  server.registerTool('get_signals', {
    title: 'Signals: what is worth doing now',
    description: 'What is worth doing now, and why, highest priority first: quotes gone quiet or about to expire, stale or slipping opportunities and ones with no next step, lost and paused opportunities worth revisiting, dormant customers, renewals coming up and contacts to ask for a referral. Each has a plain-English reason, evidence (with the last purchase, last inquiry and country of the contact, for CASL), who to contact, and a suggested action. Yacrum gives no legal verdict and sends nothing.',
    inputSchema: {
      scope: z.enum(['mine', 'team']).optional().describe('mine (default): the key\'s member\'s opportunities and accounts. team: the whole workspace'),
      salesPersonId: z.string().optional().describe('With scope team: one member\'s view'),
      types: z.array(z.enum(SIGNAL_TYPES)).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().optional().describe('nextCursor from the page before'),
      includeSnoozed: z.boolean().optional(),
    },
    annotations: READ,
  }, async ({ scope, salesPersonId, types, limit, cursor, includeSnoozed }) => run(() => yacrum.get('/signals', {
    scope, salesPersonId, types: types?.join(','), limit: limit?.toString(), cursor, includeSnoozed: includeSnoozed ? 'true' : undefined,
  }))());

  server.registerTool('snooze_signal', {
    title: 'Snooze a signal',
    description: 'Hide a signal from the key\'s member until a day (at most a year away). It comes back early if its record sees new activity. Only the member\'s own view changes; a read key may snooze.',
    inputSchema: { signalId: ID.describe('The signal\'s id, type:recordId'), until: DAY },
    annotations: UPDATES,
  }, async ({ signalId, until }) => run(() => yacrum.post(`/signals/${encodeURIComponent(signalId)}/snooze`, { until }))());

  server.registerTool('unsnooze_signal', {
    title: 'Bring a snoozed signal back',
    description: 'Remove the key\'s member\'s snooze on a signal. Safe to repeat.',
    inputSchema: { signalId: ID },
    annotations: UPDATES,
  }, async ({ signalId }) => run(() => yacrum.delete(`/signals/${encodeURIComponent(signalId)}/snooze`))());

  server.registerTool('get_outreach_settings', {
    title: 'Outreach settings',
    description: 'For drafting a member\'s email: the workspace\'s BCC logging address (put it on every draft so the sent mail is logged to the contact; null when an Admin has not turned logging on) and its outreach style guide.',
    annotations: READ,
  }, run(() => yacrum.get('/workspace/outreach')));

  server.registerTool('list_quotes', {
    title: 'List quotes',
    description: 'Quotes, optionally only one opportunity\'s, with their status, revision, expiry and totals.',
    inputSchema: { opportunityId: z.string().optional() },
    annotations: READ,
  }, async ({ opportunityId }) => run(() => yacrum.get('/quotes', { opportunityId }))());

  server.registerTool('get_quote', {
    title: 'Get a quote',
    description: 'One quote with its lines, totals, taxes, status history and acceptance.',
    inputSchema: { quoteId: ID },
    annotations: READ,
  }, async ({ quoteId }) => run(() => yacrum.get(`/quotes/${encodeURIComponent(quoteId)}`))());

  server.registerTool('list_action_items', {
    title: 'List action items',
    description: 'Action items, optionally one member\'s, one opportunity\'s or one company\'s, open or completed, or only overdue ones.',
    inputSchema: {
      ownerId: z.string().optional(),
      opportunityId: z.string().optional(),
      companyId: z.string().optional(),
      status: z.enum(['Open', 'Completed']).optional(),
      overdue: z.boolean().optional(),
    },
    annotations: READ,
  }, async ({ ownerId, opportunityId, companyId, status, overdue }) => run(() => yacrum.get('/action-items', {
    ownerId, opportunityId, companyId, status, overdue: overdue ? 'true' : undefined,
  }))());

  server.registerTool('update_action_item', {
    title: 'Update an action item',
    description: 'Complete or reopen an action item (status), or change its title, description, due date or owner (Admin, Sales, or its owner).',
    inputSchema: {
      actionItemId: ID,
      status: z.enum(['Open', 'Completed']).optional(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      dueDate: DAY.optional(),
      ownerId: z.string().optional(),
    },
    annotations: UPDATES,
  }, async ({ actionItemId, ...fields }) => run(() => yacrum.patch(`/action-items/${encodeURIComponent(actionItemId)}`, fields))());

  server.registerTool('pipeline_changes', {
    title: 'Pipeline changes since last week',
    description: 'What changed since a weekly snapshot: opportunities new, advanced, regressed, won, lost, paused or removed, those whose close date slipped or amount changed, and the open pipeline\'s totals then and now per currency.',
    inputSchema: {
      since: DAY.optional().describe('Compared with the latest weekly snapshot on or before this day; a week ago by default'),
      scope: z.enum(['mine', 'team']).optional(),
      salesPersonId: z.string().optional(),
    },
    annotations: READ,
  }, async ({ since, scope, salesPersonId }) => run(() => yacrum.get('/pipeline/changes', { since, scope, salesPersonId }))());

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
