# yacrum-mcp

> ⛔ **Retired.** Yacrum now hosts its MCP server, so there is nothing to install. **0.8.0 is the last release**
> of this package, and it is deprecated on npm. Existing installs keep working, frozen as they are, and print
> where to go instead each time they start.
>
> **Connect to the hosted server instead:** the address is `<your Yacrum address>/api/mcp`, and you sign in to
> Yacrum once. No API key is needed. Yacrum's user guide and its *Set up with Claude* screen show each app's steps.
>
> - **claude.ai and Claude Desktop:** Settings → Connectors → **Add custom connector**, and paste the address.
> - **Claude Code:** `claude mcp add --transport http yacrum <your Yacrum address>/api/mcp`
>
> The hosted server has the same tools as this one, and it also serves the skills that the Claude plugin used to
> carry. Then remove `yacrum-mcp` from your MCP config, and uninstall the plugin if you have it
> (`claude plugin uninstall yacrum@yacrum`).
>
> This repository stays readable and will be archived.

An [MCP](https://modelcontextprotocol.io) server for the **Yacrum** CRM. It lets Claude Desktop, Claude Code
and other MCP clients search, create and update your CRM records, log activity, read the pipeline and the
forecast, and summarize a deal. Your own AI does the thinking; this server only fetches from Yacrum.

It talks to Yacrum through its public REST API, with **your own API key**. A key acts as the member it was
made for, with that member's role: the server can do exactly what that person could do in the app, and
nothing more. A *read* key cannot change anything.

## Setup

There is none any more: see the notice above. Existing installs were configured with `YACRUM_API_KEY` (a `yk_…`
key from Administration → API Keys) and `YACRUM_URL` (your Yacrum address), and keep working with them.

## Tools

| Tool | What it does |
|---|---|
| `whoami` | The workspace, the member the key acts as, its scope, and this month's API usage |
| `search` | Companies, contacts, opportunities and open leads by name |
| `list_companies`, `get_company`, `create_company`, `list_company_types` | Companies |
| `list_contacts`, `create_contact` | Contacts |
| `list_opportunities`, `create_opportunity`, `update_opportunity`, `move_opportunity_stage` | Deals |
| `set_sales_health` | A deal's Sales Health (G on track, Y at risk, R off track) and the note saying why, always together. Yacrum proposes one from Qualification; it is written only on the user's approval |
| `log_activity` | A note on a company, contact, deal or lead: a call, a meeting, a decision |
| `create_action_item`, `list_action_items`, `update_action_item` | Tasks, optionally on a record, with a due date; complete or reopen one |
| `list_quotes`, `get_quote` | Quotes, with their lines, totals, taxes and status (read only) |
| `get_signals` | What is worth doing now, and why: quiet and expiring quotes, stale and slipping deals, lost and paused deals to revisit, dormant customers, renewals and referrals |
| `snooze_signal`, `unsnooze_signal` | Hide a signal from yourself until a day, or bring it back. Works with a read key |
| `get_outreach_settings` | The address to BCC on a draft so the sent mail is logged, and the workspace's style guide |
| `pipeline_changes` | What changed since last week's pipeline snapshot: new, advanced, slipped, won, lost and the totals then and now |
| `get_pipeline`, `pipeline_summary` | The stages, and open deals by stage (totals kept per currency) |
| `forecast` | Bookings, billings and cash by month (Admin, Management and Sales) |
| `qualification_score` | A deal's two scores, read apart. Qualification: twelve questions (Need, Economic impact, Access to authority, Timeline) answered 0–3 with notes and the people each is about, the score out of 100, the weakest letter and the Sales Health proposal. Fit: answers and their notes, percent of its template's maximum, and tier |
| `list_scoring_templates` | The Qualification questions as the workspace has them (on or off, help text, stage gates) and the Sales Health thresholds; and the Fit templates: questions, choices, weights, tiers and maximums |
| `score_opportunity` | Save a deal's Qualification answers (merged by key), its Fit answers and notes, or both (switching Fit template deletes the old Fit answers) |
| `update_qualification_settings` | Switch Qualification questions on or off, word their help, set or clear a stage gate on one, and change the Sales Health thresholds and late stage (Admin) |
| `stage_readiness` | The stage gates ahead of a deal (Qualification questions and sent quotes), met or not, and the next stage when all of its gates are met. Fit never gates a stage |
| `deal_context` | Everything about one deal in one read, with both scores (`qualification` and `fit`), to summarize it or draft to it, with the CASL consent facts for its contacts |
| `list_scoring_starters`, `get_workspace_setup` | The three Fit starters (Products, Services, Products and services), and how far the workspace is set up (Admin) |
| `apply_setup` | Apply the workspace's setup: the opportunity team, stages, products, forecast, quote settings, the Qualification questions that apply, and a Fit template. `dryRun` is required: `true` answers with the diff and changes nothing (Admin) |
| `set_workspace_features` | Show or hide Quotes, Forecast, the opportunity team, CASL, Products and services, and Scoring. Hiding authorizes nothing (Admin) |
| `get_quote_document` | An external quote's own document: its link, or a short-lived address for its PDF |
| `get_import_templates` | The spreadsheet templates, and what each CRM's export looks like (Admin) |
| `preview_import` | Upload an export or spreadsheet from this computer, save the answers, and see what the import would do. Nothing reaches the workspace's records (Admin) |
| `import_records`, `get_import_status`, `undo_import` | Run an import (call again while `more` is true), see where it has got, and undo it, all or none (Admin) |
| `add_stage`, `update_stage`, `reorder_stages`, `delete_stage` | Add an open stage (at a position, if asked), change, reorder or remove one, with the pipeline editor's rules (Admin) |
| `create_scoring_template`, `set_default_scoring_template` | Create a whole Fit template (questions, choices, tiers; no stage gates), and make one the default. Templates are never edited in place: customize by creating a changed copy (Admin) |
| `list_skus`, `create_sku` | The SKUs, and add one, priced in the workspace's base currency (Admin to add) |
| `list_leads`, `create_lead`, `update_lead` | Leads, open or converted, and add or change one |

There is also a **`summarize_deal`** prompt that reads a deal's context and asks for a summary and next steps.

Every tool says what it does, so your AI client can ask before a write:

| Kind | Tools | Annotations |
|---|---|---|
| Reads | `whoami`, `search`, every `list_…` and `get_…`, `pipeline_summary`, `forecast`, `qualification_score`, `deal_context`, `pipeline_changes`, `stage_readiness` | read only |
| Additions | `create_company`, `create_contact`, `create_opportunity`, `create_action_item`, `log_activity`, `preview_import` | not destructive |
| Updates | `update_opportunity`, `set_sales_health`, `update_action_item`, `snooze_signal`, `unsnooze_signal`, `set_workspace_features` | not destructive, idempotent |
| A stage move | `move_opportunity_stage` | **destructive**: a lost or paused stage records a reason and changes the forecast. A stage gate can refuse it (409 `stage_gate`); an Admin or Management member may override it with `overrideReason` |
| Scoring | `score_opportunity` | **destructive**, idempotent: switching a scored deal's Fit template deletes its Fit answers |
| Qualification settings | `update_qualification_settings` | **destructive**, idempotent: a stage gate holds every opportunity, and clearing one forgets it |
| Setup and imports | `apply_setup`, `import_records`, `undo_import` | **destructive**: each changes the workspace's stages or many records at once. Show the diff or preview and get a yes first |

**Files for an import are read from your computer.** `preview_import` takes full paths and reads only regular `.csv`
and `.xlsx` files, never through a symlink, at most 12 files, 10 MB each and 25 MB together. Anything else is refused
before a byte is read or sent.

Yacrum never sends email. To draft outreach, pair this server with your own Gmail or Microsoft 365
connector: draft in your mailbox with the BCC from `get_outreach_settings`, and log it with `log_activity`.

## The Claude plugin (retired)

[`plugin/`](./plugin) packaged this server with Yacrum's skills: the sales routines and, for an Admin, setup,
the scoring template and import. **It is retired.** The hosted server serves the same skills to every Claude app,
claude.ai on the web included, so the plugin has nothing left to carry. The marketplace stays readable, and an
installed plugin keeps working until you remove it.

## Limits

Every call counts against your workspace plan's monthly API calls. One key may make 120 requests a minute.
An import uses about one call per 200 records.
When a limit is reached, Yacrum's refusal says so, and the server passes it on to the AI as a tool error.

## Releasing

⛔ **There are no more releases: 0.8.0 is the last.** After it, every version is deprecated with
`npm deprecate yacrum-mcp "<message>"`. What follows is how 0.8.0 shipped.

npm releases are **staged** and need a maintainer's approval with 2FA. A version goes live in three steps:

1. **Bump the version** in `package.json` and `VERSION` in `src/index.ts`, and merge.
2. **Publish a GitHub release** tagged `v<version>`. The *Stage on npm* workflow checks that the tag matches,
   builds, tests, and runs `npm stage publish`. It has no token: it authenticates through npm's trusted
   publishing, and npm attaches provenance automatically.
3. **Approve it with 2FA**, either on the package's page at npmjs.com, or with:

   ```bash
   npm stage list
   npm stage approve <stage-id>
   ```

   `npm stage reject <stage-id>` discards a staged version instead.

The trusted publisher on npmjs.com (user `david-loadman`, repository `yacrum-mcp`, workflow `publish.yml`)
does **not** allow `npm publish`. Leave it that way: a compromised workflow can then stage a version but never
ship one.

## Development

```bash
npm install
npm test        # against a fake Yacrum; nothing leaves the machine
npm run build
YACRUM_API_KEY=yk_… node dist/index.js
```

The Yacrum API is described at `<YACRUM_URL>/api/v1/openapi.json`.

⚠️ **`npx yacrum-mcp` fails inside a clone of this repository**, including when Claude Code is started in it:
npm resolves `yacrum-mcp` to the local package instead of the published one, and finds no command to run. Start
Claude Code, or `npx`, from another directory, or point the MCP config at `node <clone>/dist/index.js`.

## License

MIT
