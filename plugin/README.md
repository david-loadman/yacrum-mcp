# The Yacrum plugin (retired)

⛔ **This plugin is retired.** Yacrum now hosts its MCP server, and the server serves the same skills (morning
signals, re-engage, account pulse, the pipeline review, qualifying an opportunity, reconciling a quote, and setup,
the scoring template and import for an Admin) to claude.ai, Claude Desktop and Claude Code. There is nothing left
for a plugin to carry.

**Instead:** add `<your Yacrum address>/api/mcp` as a connector, and sign in to Yacrum once. No API key is needed.

- **claude.ai and Claude Desktop:** Settings → Connectors → **Add custom connector**.
- **Claude Code:** `claude mcp add --transport http yacrum <your Yacrum address>/api/mcp`

If Claude does not offer Yacrum's skills, turn on skills from connectors in Claude's Settings.

Then uninstall the plugin, so its skills do not appear twice:

```bash
claude plugin uninstall yacrum@yacrum
```

Until you do, it keeps working as it is, on `yacrum-mcp` 0.7, which is deprecated and will not be updated.
[`SETUP.md`](./SETUP.md) is how it was set up, kept for existing installs.
