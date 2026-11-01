import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDirections } from '../../harness/lib/directions.mjs';
import { directionsBoardHtml, linesOf, NOT_WRITTEN, FALLBACK_LINE } from '../../harness/lib/directions-board.mjs';
import { esc } from '../../harness/lib/storyboard-html.mjs';
import { momentsOf } from '../../harness/media/directions-board.mjs';

const slot = (id, extra = '') => `### ${id}\n\n- family: f${id}\n- sentence: idea ${id}\n- key frame: frame ${id}\n- move: fold\n- thread: thread ${id}\n${extra}`;
const BRIEF = `# x\n\n## Directions\n\n${slot('A', '- risk: risk A\n- from: refs/a/f1.png\n')}\n${slot('B')}\n${slot('C', '- risk: [one risk]\n')}\n- picked: B, because the object carries it\n`;
const { slots, picked } = parseDirections(BRIEF);
const still = (id, k) => ({ src: `dir/${id}-${k}.png`, at: 1 });
const full = Object.fromEntries(['A', 'B', 'C'].map((id) => [id, { stills: { opening: still(id, 'o'), turn: still(id, 't'), end: still(id, 'e') }, clip: `dir/${id}-turn.mp4` }]));
const count = (html, re) => (html.match(re) ?? []).length;

test('the brief parser reads the risk and from lines of a slot', () => {
  assert.equal(slots[0].fields.risk, 'risk A');
  assert.equal(slots[0].fields.from, 'refs/a/f1.png');
  assert.equal(slots[1].fields.risk, undefined);
});

test('the grid has one column per direction, with three stills and a looping clip each', () => {
  const html = directionsBoardHtml({ film: 'x', slots, picked, media: full });
  assert.equal(count(html, /<section class="col"/g), 3);
  assert.equal(count(html, /<img /g), 9);
  assert.equal(count(html, /<video [^>]*autoplay muted loop/g), 3);
  assert.match(html, /opening at 1\.00 s/);
  assert.doesNotMatch(html, new RegExp(FALLBACK_LINE.slice(0, 20)));
});

test('every column prints the same five lines in the same order; a missing or placeholder slot reads "not written"', () => {
  const html = directionsBoardHtml({ film: 'x', slots, picked, media: full });
  const labels = (col) => [...col.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
  const cols = html.split('<section class="col"').slice(1);
  for (const c of cols) assert.deepEqual(labels(c), ['idea', 'what you see', 'what carries the eye', 'risk', 'drawn from']);
  assert.match(cols[0], /<dd>risk A<\/dd>/);
  assert.match(cols[1], /<dt>risk<\/dt><dd class="none">not written<\/dd>/);
  assert.match(cols[2], /<dt>risk<\/dt><dd class="none">not written<\/dd>/);
  assert.deepEqual(linesOf({ thread: 'a', move: 'fold' })[2], { label: 'what carries the eye', text: 'a; move: fold' });
  assert.equal(linesOf({})[0].text, NOT_WRITTEN);
});

test('without test pages the board shows one key frame each and says test pages give the full grid', () => {
  const media = Object.fromEntries(['A', 'B', 'C'].map((id) => [id, { stills: { key: { src: `dir/${id}-key.png` } } }]));
  const html = directionsBoardHtml({ film: 'x', slots, picked, media, fallback: true });
  assert.equal(count(html, /<img /g), 3);
  assert.equal(count(html, /<video/g), 0);
  assert.ok(html.includes(esc(FALLBACK_LINE)));
});

test('the pick and the question close the board, and an unwritten pick reads "not written"', () => {
  const html = directionsBoardHtml({ film: 'x', slots, picked, media: full });
  assert.match(html, /My pick:<\/b> B, because the object carries it/);
  assert.match(html, /Which one:<\/b> A \(idea A\), B \(idea B\), C \(idea C\)\?/);
  const none = directionsBoardHtml({ film: 'x', slots: [], picked: null });
  assert.match(none, /My pick:<\/b> not written/);
  assert.equal(count(none, /<section class="col"/g), 3);
});

test('a moment stays inside the test page: opening 0.5 s, the spectacle, end 0.5 s before the last frame', () => {
  assert.deepEqual(momentsOf(12, 6.2), { opening: 0.5, turn: 6.2, end: 11.5, clip: { from: 5.2, to: 7.7 } });
  assert.equal(momentsOf(10, null).turn, 5);
  assert.equal(momentsOf(10, 99).turn, 9.5);
});
