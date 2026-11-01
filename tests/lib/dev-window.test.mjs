import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planWindow } from '../../harness/lib/dev-window.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';

const HEAD = '| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n';
const EMPTY = `## Ideas\n\n${HEAD}| [s1] | [m] | [a] | [b] | [c] | [d] | [n] | [because] |\n\n## Board\n\n| a |\n|---|\n| [x] |\n`;
const FILLED = `## Ideas\n\n${HEAD}| s1 | m | metaphor: a lamp, 0.3 | literal: the thing, 0.9 | | | 1 | because it fits |\n\n## Board\n\n| a |\n|---|\n| real row |\n`;
const META = '<meta name="duration" content="12">';

function film(brief, meta = `${META}<meta name="spectacle" content="8">`) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-window-'));
  const dir = path.join(root, 'films', 'f');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.html'), `<html><head>${meta}</head></html>`);
  fs.writeFileSync(path.join(dir, 'brief.md'), brief);
  return { root, page: path.join(dir, 'page.html') };
}
const span = (f, extra = {}) => { const w = planWindow(f.page, { root: f.root, ...extra }); return w && [w.from, w.to]; };

test('a first draft with an empty plan renders 2 s around the spectacle, and the line names the full-film flags', () => {
  const f = film(EMPTY);
  assert.deepEqual(span(f), [7, 9]);
  assert.match(planWindow(f.page, { root: f.root }).line, /Ideas is empty.*--whole/);
});

test('the window falls back to the middle and stays inside the film', () => {
  assert.deepEqual(span(film(EMPTY, META)), [5, 7]);
  assert.deepEqual(span(film(EMPTY, `${META}<meta name="spectacle" content="12">`)), [10, 12]);
  assert.deepEqual(span(film(EMPTY, `${META}<meta name="spectacle" content="0">`)), [0, 2]);
});

test('no window once the plan is filled, a range is given, a draft exists, or the length is not a number', () => {
  assert.equal(span(film(FILLED)), null);
  assert.equal(span(film(EMPTY), { whole: true }), null);
  assert.equal(span(film(EMPTY), { out: 'x.mp4' }), null);
  const e = film(EMPTY);
  assert.equal(span(e, { from: 0, to: 12 }), null);
  assert.equal(span(film(EMPTY, `${META}<meta name="spectacle" content="0.1">`)).join(), '0,2');
  assert.equal(span(film(EMPTY, '<meta name="duration" content="auto">')), null);
  fs.mkdirSync(path.join(e.root, 'out'));
  fs.writeFileSync(path.join(e.root, 'out', 'f-plan-window.mp4'), '');
  assert.deepEqual(span(e), [7, 9], 'a window clip is not a draft');
  fs.writeFileSync(path.join(e.root, 'out', 'f-draft.mp4'), '');
  assert.equal(span(e), null);
});

test('dev renders the window with --small, and the whole film when --from and --to are given', () => {
  const dev = VERBS.find((v) => v.name === 'dev');
  const f = film(EMPTY);
  const page = path.relative(process.cwd(), f.page);
  const render = (v) => dev.build(v, [page]).find((s) => s.script.endsWith('render-page.mjs'));
  const args = render({}).args;
  assert.deepEqual([args[args.indexOf('--from') + 1], args[args.indexOf('--to') + 1], args.includes('--small')], ['7', '9', true]);
  assert.match(render({}).label, /rendered 7-9 s of 12 s/);
  assert.match(args[0], /page\.html$/);
  assert.match(args[1], /out[\\/]f-plan-window\.mp4$/);
  assert.equal(render({}).env.VAWE_PLAN_WINDOW, '1');
  for (const v of [{ whole: true }, { from: 0, to: 12 }, { out: 'x.mp4' }]) {
    const full = render(v);
    assert.deepEqual([full.args.includes('--small'), full.label, full.env.VAWE_PLAN_WINDOW], [false, undefined, undefined]);
  }
});
