#!/usr/bin/env node
const BANNED = [
  [/^git\s+add\s+(?:(?:-A|--all)(?:\s+\.(?=\s|$))?|\.(?=\s|$))\s*(?:[12]?>.*)?$/, 'a blanket stage of the whole tree',
   'stage explicit paths instead. With several agents in one tree, a blanket stage cannot tell your work from theirs.'],
  [/^git\s+stash\b(?!\s+list)/, 'shelving the whole working tree',
   'it takes everything dirty, including files another agent is mid-edit. Commit your own paths instead.'],
  [/^git\s+checkout\s+(--\s+)?\.(?:\s|$)/, 'discarding the whole working tree',
   'this throws away every uncommitted change in the tree, not only yours. Name the file you mean to revert.'],
  [/^git\s+reset\s+--hard\b/, 'a hard reset',
   'this destroys uncommitted work repo-wide with no recovery. If you must, name paths: git checkout HEAD -- <path>.'],
  [/^(?:\w+=\S*\s+)*(?:(?:\S*\/)?vawe\s+(?:-\S+\s+)*approve\b|node\s+(?:-\S+\s+)*\S*harness\/live\/approve\.mjs\b)/, 'an approval an agent gave itself',
   'only the person approves a plan or a draft. Show it, end with the line "If you like it, type /vawe-approve", and stop.'],
];

const commandsIn = (cmd) => cmd
  .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?^\s*\1\s*$/gm, ' ')  // heredoc bodies
  .replace(/'[^']*'/g, "''")                                   // single-quoted literals
  .replace(/"[^"]*"/g, '""')                                   // double-quoted literals
  .split(/[\n;]|&&|\|\||\|/)
  .map((p) => p.trim().replace(/^[({\s]+/, ''));

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let cmd = '';
  try {
    cmd = (JSON.parse(raw).tool_input || {}).command || '';
  } catch (e) {
    process.stderr.write('BLOCKED: no-blanket-git could not parse the PreToolUse payload it was given, so '
      + `it cannot tell whether this command is one of the four it refuses. JSON.parse failed: ${e.message}.\n\n`
      + 'Retry the command; if this repeats, the tool call is sending no-blanket-git malformed stdin.\n');
    process.exit(2);
  }
  const parts = commandsIn(cmd);
  for (const [re, name, why] of BANNED) {
    if (parts.some((p) => re.test(p))) {
      process.stderr.write(`BLOCKED: ${name}\n\n${why}\n\n`
        + 'Refused by harness/live/no-blanket-git.mjs.\n');
      process.exit(2);
    }
  }
  process.exit(0);
});
