import test from 'node:test';
import assert from 'node:assert/strict';
import { worldLines, parseFramesArgs, selectWorlds, isStarterPage } from '../../harness/lib/frames-page.mjs';
import { stillCandidates, quietestSecond, stillPlan } from '../../harness/media/world-sample.mjs';

test('parseFramesArgs reads the page, --full and --world as a comma list or repeated', () => {
  assert.deepEqual(parseFramesArgs(['p.html']), { page: 'p.html', full: false, zoom: false, worlds: [] });
  assert.deepEqual(parseFramesArgs(['p.html', '--full', '--world', 's1,s3', '--world', 's5']), { page: 'p.html', full: true, zoom: false, worlds: ['s1', 's3', 's5'] });
  assert.equal(parseFramesArgs(['p.html', '--zoom']).zoom, true);
  assert.throws(() => parseFramesArgs(['p.html', '--world']), /--world needs a world id/);
  assert.throws(() => parseFramesArgs(['p.html', '--wide']), /unknown flag --wide/);
});

test('selectWorlds keeps page order and names the page worlds for an unknown id', () => {
  const spans = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
  assert.deepEqual(selectWorlds(spans, ['s3', 's1']).map((s) => s.id), ['s1', 's3']);
  assert.equal(selectWorlds(spans, []).length, 3);
  assert.throws(() => selectWorlds(spans, ['s9']), /--world s9: no such world; this page has s1 s2 s3/);
});

test('stillCandidates starts at the middle of the span and stays inside it', () => {
  const c = stillCandidates({ start: 2, end: 6 });
  assert.equal(c[0], 4);
  assert.ok(c.every((t) => t > 2 && t < 6));
  assert.equal(stillCandidates({ id: 'a', start: 2, end: 6 }, [{ world: 'a', id: 'enter', start: 2, end: 2.5 }])[0], 2.55);
  assert.deepEqual(stillCandidates({ start: null, end: null }), [0]);
});

test('stillCandidates puts the still after the world entrances end, and ignores exits, texture and the span end', () => {
  const span = { id: 'b', start: 0, end: 6 };
  const anims = [
    { world: 'b', id: 'ramp-in', start: 3, end: 3.27 },
    { world: 'b', id: 'enter', start: 4.2, end: 4.58 },
    { world: 'b', id: 'leave', start: 5.4, end: 5.95 },
    { world: 'b', id: '', start: 0, end: 6 },
    { world: 'a', id: 'enter', start: 5, end: 5.5 },
  ];
  assert.equal(stillCandidates(span, anims)[0], 4.63);
  assert.equal(stillCandidates(span, [])[0], 3);
  assert.equal(stillCandidates(span, [{ world: 'b', id: 'enter', start: 5.7, end: 5.98 }])[0], 3);
});

const still = (t, ...boxes) => ({ t, boxes });

test('quietestSecond picks the quiet second nearest the middle, not a moving one', () => {
  const xs = [0, 20, 40, 60, 80, 100, 100, 100, 100];
  const samples = xs.map((x, t) => still(t, [x, 0, 10, 10, 1], [5, 5, 10, 10, 1]));
  assert.equal(quietestSecond(samples).t, 6);
});

test('quietestSecond leaves out an element that moves through the whole span (a camera drift)', () => {
  const drift = (t) => [t * 3, 0, 10, 10, 1];
  const samples = [0, 1, 2, 3, 4, 5, 6].map((t) => still(t, drift(t), [t < 2 ? t * 50 : 100, 0, 10, 10, 1]));
  assert.equal(quietestSecond(samples).t, 3);
});

test('stillPlan puts a data-key second first, then the quietest second, then the spread of the span', () => {
  const span = { id: 'a', start: 2, end: 6 };
  const [pinned, ...rest] = stillPlan(span, { key: 4.2, quiet: { t: 3, motion: 0 } });
  assert.deepEqual(pinned, { t: 4.2, why: 'pinned by data-key' });
  assert.equal(rest[0].t, 3);
  assert.match(rest[0].why, /^quietest/);
  assert.equal(stillPlan(span, { quiet: { t: 3, motion: 1.5 } })[0].t, 3);
  assert.equal(stillPlan(span)[0].t, 4);
  assert.deepEqual(stillPlan({ start: null, end: null }), [{ t: 0, why: 'the page never shows it' }]);
});

test('the untouched starter page is named as the starter, not as clean; a written page is not', async () => {
  const { starterPage } = await import('../../harness/cli/new.mjs');
  assert.equal(isStarterPage(starterPage({})), true);
  assert.equal(isStarterPage(starterPage({}).replace('why it matters', 'every school email')), false);
  assert.equal(isStarterPage(starterPage({}).replace('#0b0e17', '#f4efe6')), false);
  const shots = [{ id: 's1', fired: [] }, { id: 's2', fired: [] }];
  const [line] = worldLines(shots, () => [], { starter: true });
  assert.match(line, /starter page: s1, s2 .*not written yet/);
  assert.doesNotMatch(line, /clean/);
});

test('worldLines prints each rule once with every world it fired in, then the clean worlds', () => {
  const format = (fired) => fired.map((f) => `  @${f.t}s ${f.value} (rule ${f.id})`);
  const a = { id: 'tracking', value: 'loose', t: 1 };
  const shots = [{ id: 's1', fired: [a] }, { id: 's2', fired: [] }, { id: 's3', fired: [{ ...a, t: 6 }] }];
  assert.deepEqual(worldLines(shots, format), ['  s1, s3: @1s loose (rule tracking)', '  clean: s2']);
});
