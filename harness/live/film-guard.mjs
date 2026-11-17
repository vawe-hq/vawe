#!/usr/bin/env node
// PreToolUse hook of the vawe plugin: denies a hand-made write to a film file and a raw ffmpeg or Chrome call, and names the vawe tool to use.
// Run from the plugin's hooks/hooks.json with matcher "Write|Edit|MultiEdit|Bash". Exit 0 always; a denial is the JSON answer.
import { filmWrites, rawTools, commandVerbs, lookupOf, RAW_TOOLS } from '../lib/trace/calls.mjs';
import { bare } from '../lib/shell-match.mjs';

export const MCP_PREFIX = 'mcp__plugin_vawe-agent_vawe__';
const toolsNamed = (prefix) => (...names) => names.map((n) => `${prefix}${n}`).join(' or ');

const fixes = (tool) => {
  const plan = `${tool('vawe_write_doc')} or ${tool('vawe_edit_doc')} writes brief.md, DESIGN.md and kit/ files; ${tool('vawe_status')} names the open step`;
  return {
    page: `Use ${tool('vawe_write_page', 'vawe_edit_page')}: they check the page contract and return the taste rules for the beats you touch`,
    brief: plan,
    design: plan,
    kit: plan,
  };
};

/** The reason a call may not run, or null. Pure: `name` is the tool name, `input` its tool_input, `prefix` the host's tool name prefix (pi has none). */
export function denial(name, input = {}, prefix = MCP_PREFIX) {
  const tool = toolsNamed(prefix);
  const [write] = filmWrites(name, input);
  if (write) return `blocked: a hand-made write to films/${write.film}/ (${write.what}). ${fixes(tool)[write.what]}.`;
  if (name !== 'Bash') return null;
  const cmd = String(input.command ?? '');
  if (RAW_TOOLS.ffmpeg.test(bare(cmd))) return `blocked: raw ffmpeg. Use ${tool('vawe_render_draft')} to render, ${tool('vawe_look')} for a still.`;
  const usesBrowser = rawTools(cmd, commandVerbs(cmd).length > 0).includes('browser');
  if (usesBrowser && !lookupOf(name, input)) return `blocked: a raw Chrome or screenshot call. Use ${tool('vawe_look')} for full-size stills of the page.`;
  return null;
}

function main() {
  let raw = '';
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', () => {
    try {
      const call = JSON.parse(raw);
      const reason = denial(call.tool_name, call.tool_input);
      if (reason) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
    } catch { /* a hook never fails the tool call */ }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) main();
