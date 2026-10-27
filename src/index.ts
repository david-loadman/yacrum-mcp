#!/usr/bin/env node
/**
 * yacrum-mcp: an MCP server for the Yacrum CRM, over stdio.
 *
 *   YACRUM_API_KEY  a key from Yacrum → Administration → API Keys (required)
 *   YACRUM_URL      your Yacrum address (default: the Yacrum staging site)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { YacrumClient } from './client.js';
import { registerTools } from './tools.js';

export const DEFAULT_URL = 'https://yacrum--yacrum.us-central1.hosted.app';
const VERSION = '0.2.2';

async function main() {
  const apiKey = process.env.YACRUM_API_KEY;
  if (!apiKey || !/^yk_[A-Za-z0-9_-]{40}$/.test(apiKey)) {
    console.error('yacrum-mcp: set YACRUM_API_KEY to a key from Yacrum → Administration → API Keys.');
    process.exit(1);
  }
  const server = new McpServer({ name: 'yacrum', version: VERSION });
  registerTools(server, new YacrumClient({ baseUrl: process.env.YACRUM_URL || DEFAULT_URL, apiKey }));
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  // ⛔ Never the key: only what went wrong.
  console.error('yacrum-mcp failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
