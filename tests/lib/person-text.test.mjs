// node --test tests/lib/person-text.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { engineFrom, personText } from '../../harness/lib/person-text.mjs';

const AT = 'node_modules/@vawe/cli';

test('an installed package names npx vawe and puts its doc paths under the package', () => {
  assert.equal(personText('next: bin/vawe frame films/a/page.html --world all', AT), 'next: npx vawe frame films/a/page.html --world all');
  assert.equal(personText('read taste/craft/typography.md and prompts/moves/README.md', AT), `read ${AT}/taste/craft/typography.md and ${AT}/prompts/moves/README.md`);
  assert.equal(personText('The stages after it are in AGENTS.md, The loop', AT), `The stages after it are in ${AT}/AGENTS.md, The loop`);
  assert.equal(personText('(skills/vawe-transitions/SKILL.md)', AT), `(${AT}/skills/vawe-transitions/SKILL.md)`);
});

test('film paths, page imports and words that only look like a doc folder stay as they are', () => {
  const kept = ['films/a/page.html', 'out/a-draft.mp4', 'glint() from core/motion/alive.js', 'films/my-taste/prompts.md', 'the taste and the prompts', 'harness/lib/camera-moves.mjs'];
  for (const text of kept) assert.equal(personText(text, AT), text);
});

test('the package is named relative to the folder, or absolute when it sits outside it (an npx cache)', () => {
  assert.equal(engineFrom('/home/p/proj', '/home/p/proj/node_modules/@vawe/cli'), AT);
  assert.equal(engineFrom('/home/p/proj', '/home/p/.npm/_npx/abc/node_modules/@vawe/cli'), '/home/p/.npm/_npx/abc/node_modules/@vawe/cli');
});
