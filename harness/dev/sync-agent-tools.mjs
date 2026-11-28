#!/usr/bin/env node
// Rewrites the tools line of agents/vawe.md from the MCP server's tool list. Claude Code reads the file's frontmatter, so it stays static.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_NAMES } from '../mcp/server.mjs';
import { MCP_PREFIX } from '../live/film-guard.mjs';
import { isMain } from '../lib/is-main.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const AGENT = path.join(ROOT, 'agents/vawe.md');
const BUILT_IN = ['Read', 'Grep', 'Glob'];

/** The agent file text with its tools line rebuilt from TOOL_NAMES. */
export const agentFileWithTools = (text) => text.replace(/^tools:.*$/m, `tools: ${[...TOOL_NAMES.map((n) => `${MCP_PREFIX}${n}`), ...BUILT_IN].join(', ')}`);

if (isMain(import.meta.url)) {
  const text = fs.readFileSync(AGENT, 'utf8');
  const next = agentFileWithTools(text);
  if (next !== text) fs.writeFileSync(AGENT, next);
  console.log(next === text ? 'agents/vawe.md: tools line already current' : 'agents/vawe.md: tools line rewritten');
}
