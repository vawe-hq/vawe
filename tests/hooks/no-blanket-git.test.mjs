// node tests/hooks/no-blanket-git.test.mjs
//
// Feeds each case through the real hook as a child process, exactly as Claude Code does.
//
// The cases live in a JSON FILE rather than in this source, and this file names no banned command
// literally. Both are deliberate: the first two versions of the hook blocked their own test run,
// because the cases sat in the shell command that launched it.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK = join(here, '../../harness/live', 'no-blanket-git.mjs');
const cases = JSON.parse(readFileSync(join(here, 'no-blanket-git.cases.json'), 'utf8'));

let bad = 0;
for (const [command, shouldBlock, why] of cases) {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8' });
  const blocked = r.status === 2;
  const ok = blocked === shouldBlock;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${blocked ? 'block' : 'allow'}  ${why}`);
}

// This hook exists to refuse four commands; a payload it cannot parse might be hiding one of them, so
// it must block rather than wave the call through. Same reasoning as stage-gate.mjs's own case.
{
  const r = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8' });
  const blocked = r.status === 2 && /could not parse/.test(r.stderr);
  const ok = blocked;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  block  malformed stdin must deny, not permit`);
}

const FILE_CASES = [
  [{ file_path: 'out/f.approved' }, true, 'Write to the approval file'],
  [{ file_path: '/repo/out/f.plan-approved' }, true, 'Write to the plan approval file'],
  [{ file_path: 'films/x/../../out/f-look-riso.approved' }, true, 'a ../ path to the approval file'],
  [{ notebook_path: 'out/f.approved' }, true, 'NotebookEdit of the approval file'],
  [{ file_path: 'films/f/page.html' }, false, 'an ordinary page edit'],
  [{ file_path: 'films/f/brief.md' }, false, 'the brief'],
];
for (const [input, shouldBlock, why] of FILE_CASES) {
  const r = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: input }), encoding: 'utf8' });
  const ok = (r.status === 2) === shouldBlock;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${r.status === 2 ? 'block' : 'allow'}  ${why}`);
}

const total = cases.length + FILE_CASES.length + 1;
console.log(bad === 0 ? `\nall ${total} cases correct` : `\n${bad} of ${total} WRONG`);
process.exit(bad === 0 ? 0 : 1);
