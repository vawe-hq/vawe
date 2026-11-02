#!/usr/bin/env node
import path from 'node:path';
const BANNED = [
  [/^git\s+add\s+(?:(?:-A|--all)(?:\s+\.(?=\s|$))?|\.(?=\s|$))\s*(?:[12]?>.*)?$/, 'a blanket stage of the whole tree',
   'stage explicit paths instead. With several agents in one tree, a blanket stage cannot tell your work from theirs.'],
  [/^git\s+stash\b(?!\s+list)/, 'shelving the whole working tree',
   'it takes everything dirty, including files another agent is mid-edit. Commit your own paths instead.'],
  [/^git\s+checkout\s+(--\s+)?\.(?:\s|$)/, 'discarding the whole working tree',
   'this throws away every uncommitted change in the tree, not only yours. Name the file you mean to revert.'],
  [/^git\s+reset\s+--hard\b/, 'a hard reset',
   'this destroys uncommitted work repo-wide with no recovery. If you must, name paths: git checkout HEAD -- <path>.'],
];

const ONLY_PERSON = 'only the person approves a plan or a draft. Show it, end with the line "If you like it, type /vawe-approve", and stop.';
const APPROVE_VERB = /\bvawe(?:-dev)?\s+(?:[^;&|\n]*\s)?approve\b/;
const APPROVE_OTHER = /approve\.mjs|\.(?:plan-)?approved\b|\bwrite(?:Plan)?Approval\b/;
const ASKS_HELP = /\s(?:--help|-h)(?:\s|$)/;
const APPROVE_FILE = /\.(?:plan-)?approved$/;

// These read the raw command, quotes and all: bash -c, env, command, npx, node -e and echo > file reach the same act.
const RAW_BANNED = [
  [(cmd) => APPROVE_OTHER.test(cmd) || (APPROVE_VERB.test(cmd) && !ASKS_HELP.test(cmd)), 'an approval an agent gave itself',
   ONLY_PERSON],
  [(cmd) => /\bVAWE_UNATTENDED\s*=/.test(cmd), 'a ship that skips the approvals',
   ONLY_PERSON],
];

const commandsIn = (cmd) => cmd
  .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?^\s*\1\s*$/gm, ' ')  // heredoc bodies
  .replace(/'[^']*'/g, "''")                                   // single-quoted literals
  .replace(/"[^"]*"/g, '""')                                   // double-quoted literals
  .split(/[\n;]|&&|\|\||\|/)
  .map((p) => p.trim().replace(/^[({\s]+/, ''));

function refuse(name, why) {
  process.stderr.write(`BLOCKED: ${name}\n\n${why}\n\nRefused by harness/live/no-blanket-git.mjs.\n`);
  process.exit(2);
}

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let cmd = '';
  let file = '';
  try {
    const input = JSON.parse(raw).tool_input || {};
    cmd = input.command || '';
    file = path.normalize(input.file_path || input.notebook_path || '');
  } catch (e) {
    process.stderr.write('BLOCKED: no-blanket-git could not parse the PreToolUse payload it was given, so '
      + `it cannot tell whether this command is one of the four it refuses. JSON.parse failed: ${e.message}.\n\n`
      + 'Retry the command; if this repeats, the tool call is sending no-blanket-git malformed stdin.\n');
    process.exit(2);
  }
  if (APPROVE_FILE.test(file)) refuse('writing an approval file', ONLY_PERSON);
  for (const [test, name, why] of RAW_BANNED) if (test(cmd)) refuse(name, why);
  const parts = commandsIn(cmd);
  for (const [re, name, why] of BANNED) {
    if (parts.some((p) => re.test(p))) refuse(name, why);
  }
  process.exit(0);
});
