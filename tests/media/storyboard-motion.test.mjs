// `vawe frame --board` prints the motion lint findings of the page before any render.
// Needs Chrome.
//   node --test tests/media/storyboard-motion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PAGE = path.resolve('tests/fixtures/pages/storyboard-lockstep/page.html');
const run = (page) => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sb-motion-')), 'board.html');
  const r = spawnSync('node', ['harness/media/storyboard.mjs', page, '--out', out, '--all'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

test('storyboard prints the lockstep and default-ease findings with their fixes', () => {
  const out = run(PAGE);
  assert.match(out, /rule named-eases @0\.40s lockstep: 3 elements move in lockstep.*; fix: offset the second layer/);
  assert.match(out, /default-ease: div#a moves transform for 0\.80 s on the CSS keyword ease easing; fix: Entrance: EASE\.land/);
});

test('storyboard drops a finding the page waives', () => {
  const waived = fs.readFileSync(PAGE, 'utf8').replace('</head>',
    '<script type="application/json" id="authoring">{"allow": ["lockstep"], "_why": {"lockstep": "the three boxes are one block on purpose: all start at 0.40 s"}}</script>\n</head>');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-waived-'));
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, waived);
  const out = run(page);
  assert.doesNotMatch(out, / lockstep: /);
  assert.match(out, /default-ease: div#a/);
});
