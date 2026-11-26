/**
 * yacrum-mcp is retired (david-loadman/yacrum#535, D273): Yacrum hosts its MCP
 * server at `<your Yacrum address>/api/mcp`.
 */

/** What every start prints, before anything else: where to go instead. */
export function retiredNotice(baseUrl: string): string {
  const connector = `${baseUrl.replace(/\/+$/, '')}/api/mcp`;
  return [
    'yacrum-mcp is retired: 0.8.0 is its last release, and it will not be updated.',
    `Connect Claude to Yacrum's hosted server instead: ${connector}`,
    'In claude.ai or Claude Desktop, add it under Settings → Connectors → Add custom connector.',
    `In Claude Code: claude mcp add --transport http yacrum ${connector}`,
    'It needs no key: you sign in to Yacrum once. Then remove this server from your MCP config.',
  ].join('\n');
}
