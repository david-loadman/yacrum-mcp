#!/usr/bin/env node
/**
 * yacrum-mcp: an MCP server for the Yacrum CRM, over stdio.
 *
 * ⛔ RETIRED. 0.8.0 is the last release: Yacrum now hosts its MCP server at
 * `<your Yacrum address>/api/mcp` (david-loadman/yacrum#535). This still runs
 * for existing installs, and says so on every start.
 *
 *   YACRUM_API_KEY  a key from Yacrum → Administration → API Keys (required)
 *   YACRUM_URL      your Yacrum address (default: the Yacrum staging site)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { YacrumClient } from './client.js';
import { registerTools } from './tools.js';
import { retiredNotice } from './retired.js';

export const DEFAULT_URL = 'https://yacrum--yacrum.us-central1.hosted.app';
const VERSION = '0.8.0';

async function main() {
  const baseUrl = process.env.YACRUM_URL || DEFAULT_URL;
  console.error(retiredNotice(baseUrl));
  const apiKey = process.env.YACRUM_API_KEY;
  if (!apiKey || !/^yk_[A-Za-z0-9_-]{40}$/.test(apiKey)) {
    console.error('yacrum-mcp: set YACRUM_API_KEY to a key from Yacrum → Administration → API Keys.');
    process.exit(1);
  }
  const server = new McpServer({ name: 'yacrum', version: VERSION });
  registerTools(server, new YacrumClient({ baseUrl, apiKey }));
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  // ⛔ Never the key: only what went wrong.
  console.error('yacrum-mcp failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
