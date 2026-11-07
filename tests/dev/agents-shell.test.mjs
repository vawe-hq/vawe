import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hintFor } from '../../harness/live/verb-hint.mjs';

const agents = fs.readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');

test('AGENTS.md Shell tells an agent to render in the background, and an in-place edit gets the advice to edit with assertion', () => {
  const shell = agents.split('\n## Shell')[1].split('\n## ')[0];
  assert.match(shell, /start a long render in the background yourself/);
  assert.match(hintFor("sed -i '' 's/a/b/' AGENTS.md")?.say ?? '', /Edit tool/);
});

test('AGENTS.md says a waiver is for the point of the shot and the fix comes first', () => {
  assert.match(agents, /A waiver is for a break that is the point of the shot\. For any other break, try the fix first/);
});
