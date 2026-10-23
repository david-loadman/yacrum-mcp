# yacrum-mcp

An [MCP](https://modelcontextprotocol.io) server for the **Yacrum** CRM. It lets Claude Desktop, Claude Code
and other MCP clients search, create and update your CRM records, log activity, read the pipeline and the
forecast, and summarise a deal. Your own AI does the thinking; this server only fetches from Yacrum.

It talks to Yacrum through its public REST API, with **your own API key**. A key acts as the member it was
made for, with that member's role: the server can do exactly what that person could do in the app, and
nothing more. A *read* key cannot change anything.

## Setup

1. In Yacrum, an Admin opens **Customization → API Keys**, makes a key for you, and copies it. The key is
   shown only once. Choose **Read and write** if you want the AI to create and update records.
2. Add the server to your MCP client.

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yacrum": {
      "command": "npx",
      "args": ["-y", "yacrum-mcp"],
      "env": {
        "YACRUM_API_KEY": "yk_your_key_here",
        "YACRUM_URL": "https://yacrum--yacrum.us-central1.hosted.app"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add yacrum --env YACRUM_API_KEY=yk_your_key_here -- npx -y yacrum-mcp
```

| Variable | |
|---|---|
| `YACRUM_API_KEY` | Required. A key from Customization → API Keys (`yk_…`). |
| `YACRUM_URL` | Your Yacrum address. Defaults to the Yacrum staging site. |

## Tools

| Tool | What it does |
|---|---|
| `whoami` | The workspace, the member the key acts as, its scope, and this month's API usage |
| `search` | Companies, contacts, opportunities and open leads by name |
| `list_companies`, `get_company`, `create_company`, `list_company_types` | Companies |
| `list_contacts`, `create_contact` | Contacts |
| `list_opportunities`, `create_opportunity`, `update_opportunity`, `move_opportunity_stage` | Deals |
| `log_activity` | A note on a company, contact, deal or lead: a call, a meeting, a decision |
| `create_action_item`, `list_action_items`, `update_action_item` | Tasks, optionally on a record, with a due date; complete or reopen one |
| `list_quotes`, `get_quote` | Quotes, with their lines, totals, taxes and status (read only) |
| `get_signals` | What is worth doing now, and why: quiet and expiring quotes, stale and slipping deals, lost and paused deals to revisit, dormant customers, renewals and referrals |
| `snooze_signal`, `unsnooze_signal` | Hide a signal from yourself until a day, or bring it back. Works with a read key |
| `get_outreach_settings` | The address to BCC on a draft so the sent mail is logged, and the workspace's style guide |
| `pipeline_changes` | What changed since last week's pipeline snapshot: new, advanced, slipped, won, lost and the totals then and now |
| `get_pipeline`, `pipeline_summary` | The stages, and open deals by stage (totals kept per currency) |
| `forecast` | Bookings, billings and cash by month (Admin, Management and Sales) |
| `qualification_score` | A deal's qualification answers, scores and tier |
| `deal_context` | Everything about one deal in one read, to summarise it |

There is also a **`summarize_deal`** prompt that reads a deal's context and asks for a summary and next steps.

Every tool says what it does, so your AI client can ask before a write:

| Kind | Tools | Annotations |
|---|---|---|
| Reads | `whoami`, `search`, every `list_…` and `get_…`, `pipeline_summary`, `forecast`, `qualification_score`, `deal_context`, `pipeline_changes` | read only |
| Additions | `create_company`, `create_contact`, `create_opportunity`, `create_action_item`, `log_activity` | not destructive |
| Updates | `update_opportunity`, `update_action_item`, `snooze_signal`, `unsnooze_signal` | not destructive, idempotent |
| A stage move | `move_opportunity_stage` | **destructive**: a lost or paused stage records a reason and changes the forecast |

Yacrum never sends email. To draft outreach, pair this server with your own Gmail or Microsoft 365
connector: draft in your mailbox with the BCC from `get_outreach_settings`, and log it with `log_activity`.

## Limits

Every call counts against your workspace plan's monthly API calls. One key may make 120 requests a minute.
When a limit is reached, Yacrum's refusal says so, and the server passes it on to the AI as a tool error.

## Development

```bash
npm install
npm test        # against a fake Yacrum; nothing leaves the machine
npm run build
YACRUM_API_KEY=yk_… node dist/index.js
```

The Yacrum API is described at `<YACRUM_URL>/api/v1/openapi.json`.

## Licence

MIT
