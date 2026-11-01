import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDirections } from '../../harness/lib/directions.mjs';
import { directionsBoardHtml, linesOf, pickText, optionName, NOT_WRITTEN, FALLBACK_LINE } from '../../harness/lib/directions-board.mjs';
import { esc } from '../../harness/lib/storyboard-html.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { UsageError } from '../../harness/cli/parse.mjs';
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
  assert.match(html, /Start at 1\.00 s/);
  assert.doesNotMatch(html, new RegExp(FALLBACK_LINE.slice(0, 20)));
});

test('every column prints the same five lines in the same order; a missing or placeholder slot reads "not written"', () => {
  const html = directionsBoardHtml({ film: 'x', slots, picked, media: full });
  const labels = (col) => [...col.matchAll(/<div class="k">([^<]+)<\/div>/g)].map((m) => m[1]);
  const cols = html.split('<section class="col"').slice(1);
  for (const c of cols) assert.deepEqual(labels(c), ['The idea', 'What you see happen', 'Where your eye goes', 'What could go wrong', 'Inspired by']);
  assert.match(cols[0], /<div class="v">risk A<\/div>/);
  assert.match(cols[1], /<div class="k">What could go wrong<\/div><div class="v none">not written<\/div>/);
  assert.match(cols[2], /<div class="k">What could go wrong<\/div><div class="v none">not written<\/div>/);
  assert.deepEqual(linesOf({ thread: 'a', move: 'fold' })[2], { label: 'Where your eye goes', text: 'a; move: fold' });
  assert.equal(linesOf({})[0].text, NOT_WRITTEN);
});

test('without test pages the board shows one key frame each and says test pages give the full grid', () => {
  const media = Object.fromEntries(['A', 'B', 'C'].map((id) => [id, { stills: { key: { src: `dir/${id}-key.png` } } }]));
  const html = directionsBoardHtml({ film: 'x', slots, picked, media });
  assert.equal(count(html, /<img /g), 3);
  assert.equal(count(html, /<video/g), 0);
  assert.ok(html.includes(esc(FALLBACK_LINE)));
});

test('some test pages and not all: the other columns keep their row count and show the directions.html still', () => {
  const media = { A: full.A, B: { stills: { key: { src: 'dir/b-key.png' } } }, C: { stills: { key: { src: 'dir/c-key.png' } } } };
  const html = directionsBoardHtml({ film: 'x', slots, picked, media });
  const rows = [...html.matchAll(/--rows:(\d+)/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['10', '10', '10']);
  assert.equal(count(html, /<img /g), 5);
  assert.equal(count(html, /no sample film/g), 6);
  assert.ok(html.includes(esc(FALLBACK_LINE)));
});

test('every column spans the same grid rows, so the five lines sit on one row each across columns', () => {
  const html = directionsBoardHtml({ film: 'x', slots, picked, media: full });
  assert.match(html, /grid-template-rows:subgrid/);
  assert.deepEqual([...html.matchAll(/--rows:(\d+)/g)].map((m) => m[1]), ['10', '10', '10']);
});

test('the pick and the question close the board, and an unwritten pick reads "not written"', () => {
  const html = directionsBoardHtml({ film: 'x', slots, picked, media: full });
  assert.match(html, /My pick:<\/b> B, because the object carries it/);
  assert.match(html, /Which one do you want\?<\/b> A \(fA\), B \(fB\), C \(fC\)/);
  const none = directionsBoardHtml({ film: 'x', slots: [], picked: null });
  assert.match(none, /My pick:<\/b> not written/);
  assert.equal(count(none, /<section class="col"/g), 3);
});

test('a moment stays inside the test page: opening 0.5 s, the spectacle, end 0.5 s before the last frame', () => {
  assert.deepEqual(momentsOf(12, 6.2), { opening: 0.5, turn: 6.2, end: 11.5, clip: { from: 5.2, to: 7.7 } });
  assert.equal(momentsOf(10, null).turn, 5);
  assert.equal(momentsOf(10, 99).turn, 9.5);
});

const RISO = `## Directions\n\n### A\n\n- family: type-led (the film is carried by type)\n- sentence: the line is stamped.\n- key frame: cream sheet.\n- move: stamp (the plate hits).\n- thread: the type line.\n\n### B\n\n- family: object-led (a real thing or the product UI)\n- sentence: one page travels through four printed worlds and a projector turns it into a film.\n- key frame: the hall at the strike.\n- move: [one verb]\n- thread: [the one thing]\n\n- picked: B with C's squeegee as the cut grammar, because the owner fixed the scenes\n`;

test('a pick written with its own "because" prints as written, and one without gets "because" added', () => {
  const { picked: p } = parseDirections(RISO);
  assert.equal(pickText(p), "B with C's squeegee as the cut grammar, because the owner fixed the scenes");
  assert.equal(pickText({ id: 'B', reason: 'the object carries it' }), 'B, because the object carries it');
  assert.equal(pickText({ id: 'B', reason: '' }), 'B');
  assert.equal(pickText(null), NOT_WRITTEN);
});

test('the question names options by family, or the first words of the idea', () => {
  const { slots: s } = parseDirections(RISO);
  assert.equal(optionName('B', s[1].fields), 'B (object-led)');
  assert.equal(optionName('X', { sentence: 'one page travels through four printed worlds' }), 'X (one page travels through)');
  assert.equal(optionName('X', {}), 'X');
  assert.match(directionsBoardHtml({ film: 'x', slots: s, picked: null }), /Which one do you want\?<\/b> A \(type-led\), B \(object-led\)/);
});

test('the eye line tests thread and move apart: a placeholder move is dropped, a trailing full stop too', () => {
  const { slots: s } = parseDirections(RISO);
  assert.equal(linesOf(s[0].fields)[2].text, 'the type line; move: stamp (the plate hits).');
  assert.equal(linesOf(s[1].fields)[2].text, NOT_WRITTEN);
  assert.equal(linesOf({ thread: '[the one thing]', move: 'fold' })[2].text, 'move: fold');
});

test('a brief with no Directions section still builds columns from the media ids', () => {
  const html = directionsBoardHtml({ film: 'x', slots: [], picked: null, media: { A: full.A, B: full.B } });
  assert.equal(count(html, /<section class="col"/g), 2);
});

test('--directions is a usage error with --page, --text, --json or --all, and needs a page', () => {
  const build = (v, input = 'films/x/page.html') => VERBS.find((x) => x.name === 'storyboard').build({ directions: true, ...v }, [input]);
  for (const bad of [{ page: 'p.html' }, { text: true }, { json: true }, { all: true }]) assert.throws(() => build(bad), UsageError);
  assert.throws(() => build({}, 'out/x.mp4'), UsageError);
  assert.deepEqual(build({}).map((c) => c.script), ['harness/media/directions-board.mjs']);
});
