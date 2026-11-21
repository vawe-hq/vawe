import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planAdvice } from '../../harness/lib/dev-window.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';

const HEAD = '| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n';
const EMPTY = `## Ideas\n\n${HEAD}| [s1] | [m] | [a] | [b] | [c] | [d] | [n] | [because] |\n\n## Board\n\n| a |\n|---|\n| [x] |\n`;
const FILLED = `## Ideas\n\n${HEAD}| s1 | m | metaphor: a lamp, 0.3 | literal: the thing, 0.9 | | | 1 | because it fits |\n\n## Board\n\n| a |\n|---|\n| real row |\n`;
const META = '<meta name="duration" content="12"><meta name="spectacle" content="8">';

function film(brief) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-window-'));
  const dir = path.join(root, 'films', 'f');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.html'), `<html><head>${META}</head></html>`);
  fs.writeFileSync(path.join(dir, 'brief.md'), brief);
  return { root, page: path.join(dir, 'page.html') };
}

test('an empty plan prints one line that says the whole film renders anyway', () => {
  const f = film(EMPTY);
  assert.match(planAdvice(f.page, { root: f.root }), /Ideas is empty.*whole film renders anyway/);
  assert.equal(planAdvice(film(FILLED).page, { root: film(FILLED).root }), null);
});

test('no line once a full draft exists', () => {
  const f = film(EMPTY);
  fs.mkdirSync(path.join(f.root, 'out'));
  fs.writeFileSync(path.join(f.root, 'out', 'f-draft.mp4'), '');
  assert.equal(planAdvice(f.page, { root: f.root }), null);
});

test('dev with an empty plan renders the whole film at the usual size, and --whole changes nothing', () => {
  const dev = VERBS.find((v) => v.name === 'dev');
  const f = film(EMPTY);
  const page = path.relative(process.cwd(), f.page);
  const render = (v) => dev.build(v, [page]).find((s) => s.script.endsWith('render-page.mjs'));
  const plain = render({});
  assert.equal(plain.args.includes('--from') || plain.args.includes('--to') || plain.args.includes('--small'), false);
  assert.equal(plain.env, undefined);
  assert.match(plain.label, /Ideas is empty/);
  assert.deepEqual(render({ whole: true }).args, plain.args);
  const ranged = render({ from: 2, to: 5 }).args;
  assert.deepEqual([ranged[ranged.indexOf('--from') + 1], ranged[ranged.indexOf('--to') + 1]], ['2', '5']);
});
