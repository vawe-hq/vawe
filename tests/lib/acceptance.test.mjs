import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, targetTest, withHistory, tableLines, summaryLine, allMeasuredGreen, DEFAULT_ROWS } from '../../harness/lib/acceptance.mjs';

const clean = { smooth: { frozen: [], jerky: [], jumps: [] }, stills: [], tail: 2, caps: [{ text: 'Hi', cap: 7, t: 1 }], contrast: [], collisions: [], readHold: [], exits: [], lufs: -20, peak: -12 };
const byMetric = (rows) => Object.fromEntries(rows.map((r) => [r.metric, r]));

test('targetTest reads the number rule out of each default target', () => {
  assert.ok(targetTest('under 5')(4) && !targetTest('under 5')(5));
  assert.ok(targetTest('4 or fewer')(4) && !targetTest('4 or fewer')(5));
  assert.ok(targetTest('6% or more')(6) && !targetTest('6% or more')(5.9));
  assert.ok(targetTest('4.5:1 or more')(4.5));
  assert.ok(targetTest('-24 to -16 LUFS (guess: change me)')(-20) && !targetTest('-24 to -16 LUFS')(-30));
  assert.ok(targetTest('-10 dBFS or lower')(-10) && !targetTest('-10 dBFS or lower')(-9));
  assert.ok(targetTest('0')(0) && !targetTest('0')(1));
  assert.ok(targetTest('within 1% of frame')(1) && !targetTest('within 1 frame')(2));
  assert.equal(targetTest('all'), null);
});

test('a clean draft with no brief tables: measured rows green, spec rows say no spec, judge not run', () => {
  const rows = byMetric(buildRows([], clean));
  assert.equal(Object.keys(rows).length, DEFAULT_ROWS.length);
  assert.equal(rows['jerky steps'].status, 'ok');
  assert.equal(rows['word cap height and position vs spec'].measured, 'not measured: no spec');
  assert.equal(rows['cuts vs spec'].status, 'not measured');
  assert.equal(rows['judge: each storyboard frame as beautiful as the anchor, full size'].measured, 'not measured: not run');
  assert.ok(allMeasuredGreen(Object.values(rows)));
});

test('a missed row is advice with the times and the fix, and uses the brief target', () => {
  const m = { ...clean, smooth: { frozen: [{ t: 1.2, frames: 4 }], jerky: Array(6).fill({ t: 2, ratio: 3 }), jumps: [] }, caps: [{ text: 'tiny', cap: 4.2, t: 3 }] };
  const rows = byMetric(buildRows([{ metric: 'jerky steps', target: 'under 8' }, { metric: 'frozen runs of 3+ frames inside a shot', target: '0' }, { metric: 'text cap height', target: '6% or more' }], m));
  assert.equal(rows['jerky steps'].status, 'ok');
  assert.equal(rows['frozen runs of 3+ frames inside a shot'].status, 'advice');
  assert.match(rows['frozen runs of 3+ frames inside a shot'].detail[0], /1\.20 s: 4 frames still/);
  assert.equal(rows['text cap height'].measured, '4.2%');
  assert.ok(!allMeasuredGreen(Object.values(rows)));
});

test('an unknown metric is not measured, and the retired time rows of an old brief are left out', () => {
  const rows = buildRows([{ metric: 'mood', target: 'warm' }, { metric: 'word appear time vs spec', target: 'within 0.05 s' }, { metric: 'objects in/settle/out vs spec', target: 'within 0.05 s' }], clean);
  assert.deepEqual(rows.map((r) => r.metric), ['mood']);
  assert.match(rows[0].measured, /no measure for this metric/);
});

test('spec rows take the worst deviation against the brief target', () => {
  const layout = [{ label: '"a" cap height at 1 s', spec: 8, got: 7.5, dev: 0.5, unit: '%' }, { label: '"b" x at 2 s', spec: 10, got: 12.3, dev: 2.3, unit: '%' }];
  const [row] = buildRows([{ metric: 'word cap height and position vs spec', target: 'within 1% of frame' }], { layout });
  assert.equal(row.status, 'advice');
  assert.equal(row.measured, '2.3%');
  assert.match(row.detail[0], /"b" x at 2 s: spec 10.0%, film 12.3%/);
});

test('spec rows name the words they could not measure and stay green for the rest; with none measurable they say why', () => {
  const rule = [{ metric: 'word cap height and position vs spec', target: 'within 1% of frame' }];
  const ok = [{ label: '"a" x (centre) at 1 s', spec: 50, got: 50, dev: 0, unit: '%' }];
  const [some] = buildRows(rule, { layout: ok, layoutSkipped: { unseen: ['b'], moving: [] } });
  assert.equal(some.status, 'ok');
  assert.equal(some.measured, '0.0% (not measured: "b" never on screen)');
  const [none] = buildRows(rule, { layout: [], layoutSkipped: { unseen: ['b'], moving: ['c'] } });
  assert.match(none.measured, /no Words text measurable: "b" never on screen, "c" never at rest in the frame/);
});

test('a row the final cannot measure keeps the draft value, marked', () => {
  const carry = [{ metric: 'text collisions', status: 'ok', measured: '0', detail: [] }];
  const [row] = buildRows([{ metric: 'text collisions', target: '0' }], {}, { carry });
  assert.equal(row.status, 'ok');
  assert.equal(row.measured, '0 (draft)');
});

test('the judge row reads YES counts and lists the fixes of the NO frames', () => {
  const judge = { yes: 4, total: 6, fixes: ['key 2 at 1.2 s: sharpen the type'] };
  const [row] = buildRows([{ metric: 'judge: each storyboard frame as beautiful as the anchor, full size', target: 'YES' }], { judge });
  assert.equal(row.status, 'advice');
  assert.equal(row.measured, '4 of 6 YES');
});

test('history keeps the last 10 and the summary shows the trend', () => {
  let file = null, was = null, entry;
  for (let i = 0; i < 12; i++) ({ file, entry, was } = withHistory(file, buildRows([], clean), { stage: 'draft', at: `t${i}` }));
  assert.equal(file.history.length, 10);
  assert.equal(file.history[0].at, 't2');
  assert.equal(was, entry.green);
  const rows = buildRows([], { ...clean, stills: [{ a: 1, b: 2, len: 1 }] });
  const lines = tableLines(rows, 9);
  assert.match(lines.at(-1), /^acceptance: \d+ of 15 green, \d+ not measured \(was 9\)$/);
  assert.ok(lines.some((l) => l.includes('still windows over 0.5 s outside a declared hold | 0 | 1')));
  assert.ok(!lines.some((l) => l.includes('jerky steps')));
});

test('the draft and the ship use the same 15 rows: the draft names the rows only ship measures', () => {
  const draft = buildRows([], clean, { stage: 'draft' });
  const ship = buildRows([], clean);
  assert.equal(draft.length, ship.length);
  assert.equal(summaryLine(draft, null), 'acceptance: 12 of 12 measured green, 1 more at ship (15 rows)');
  assert.equal(tableLines(ship).at(-1), 'acceptance: 12 of 15 green, 3 not measured');
});

test('the loudness row names the dB to change; the peak row names the loudest cue', () => {
  const cues = [{ name: 'impact', at: 2.4, peakDb: -5 }];
  const rows = byMetric(buildRows([], { ...clean, lufs: -28.8, peak: -2, cues }));
  assert.match(rows.loudness.detail[0], /the mix is 9 dB under the target/);
  assert.match(rows.peak.detail[0], /on the loudest cue "impact" at 2\.4 s by 1 dB/);
});

test('text cap height: product chrome passes at its own floor and a plain line still needs the target', () => {
  const rows = (caps) => byMetric(buildRows([{ metric: 'text cap height', target: '6% or more' }], { ...clean, caps }));
  assert.equal(rows([{ text: 'Inbox', cap: 3, t: 1, chrome: true }, { text: 'Hi', cap: 7, t: 1 }])['text cap height'].status, 'ok');
  const low = rows([{ text: 'Inbox', cap: 2, t: 1, chrome: true }])['text cap height'];
  assert.equal(low.status, 'advice');
  assert.match(low.detail[0], /data-chrome floor 2\.5%/);
  assert.equal(rows([{ text: 'Hi', cap: 3, t: 1 }])['text cap height'].status, 'advice');
});

test('text cap height: the measure names the floor of each kind, so a chrome 2.5% never sits beside a 6% target alone', () => {
  const row = (caps) => buildRows([{ metric: 'text cap height', target: '6% or more' }], { ...clean, caps })[0];
  assert.equal(row([{ text: 'Inbox', cap: 2.6, t: 1, chrome: true }, { text: 'Hi', cap: 7, t: 1 }]).measured, '7.0%, data-chrome 2.6% (floor 2.5%)');
  assert.equal(row([{ text: 'Inbox', cap: 2.6, t: 1, chrome: true }]).measured, 'data-chrome 2.6% (floor 2.5%)');
  assert.equal(row([{ text: 'Hi', cap: 3.2, t: 1 }, { text: 'Inbox', cap: 4, t: 1, chrome: true }]).measured, '3.2%, data-chrome 4.0% (floor 2.5%)');
});

test('read hold: lines with no measurable hold are named in the measure, not failed', () => {
  const [row] = buildRows([{ metric: 'read hold per line', target: 'max(1.2 s, words/3 s) or more' }], { ...clean, readHold: [], readHoldUnmeasured: [{ text: 'Go' }] });
  assert.equal(row.status, 'ok');
  assert.match(row.measured, /1 not measured/);
});

test('withHistory keeps the measured spec of a draft for spec-sync', () => {
  const { file } = withHistory(null, [], { stage: 'draft', spec: { words: [], objects: [] }, at: 'now' });
  assert.deepEqual(file.history[0].spec, { words: [], objects: [] });
});

test('text cap height: UI that is the subject has its own floor, 3% by default and the declared ui-scale when set', () => {
  const caps = [{ text: 'Start', cap: 3.4, t: 1, ui: true }, { text: 'Title', cap: 7, t: 1 }];
  const row = (m) => buildRows([], { ...clean, caps, ...m }).find((r) => r.metric === 'text cap height');
  assert.equal(row({}).status, 'ok');
  assert.match(row({}).measured, /data-ui 3\.4% \(floor 3%\)/);
  assert.equal(buildRows([], { ...clean, caps: [{ text: 'Start', cap: 2.6, t: 1, ui: true }] }).find((r) => r.metric === 'text cap height').status, 'advice');
  assert.equal(row({ caps: [{ text: 'Start', cap: 2.6, t: 1, ui: true }], decls: { uiScale: 2.5 } }).status, 'ok');
  assert.equal(row({ caps: [{ text: 'Title', cap: 3.4, t: 1 }] }).status, 'advice');
});

test('a DESIGN.md type-scale replaces the house 6% and the row target names the line it followed', () => {
  const m = { ...clean, caps: [{ text: 'Menu', cap: 3.6, t: 1 }], decls: { typeScale: 3.5, uiScale: null } };
  const row = buildRows([], m).find((r) => r.metric === 'text cap height');
  assert.equal(row.status, 'ok');
  assert.match(row.target, /followed DESIGN\.md type-scale: 3\.5%/);
  const edited = buildRows([{ metric: 'text cap height', target: '5% or more' }], m).find((r) => r.metric === 'text cap height');
  assert.equal(edited.status, 'advice');
  assert.equal(edited.target, '5% or more');
});

test('withHistory keeps the page facts a final check reads: tailMoving (true or false), cameraOnly, canvasFilm', () => {
  const entry = (facts) => withHistory(null, [], { stage: 'draft', at: 'now', ...facts }).file.history[0];
  assert.equal(entry({ tailMoving: true }).tailMoving, true);
  assert.equal(entry({ tailMoving: false }).tailMoving, false);
  assert.ok(!('tailMoving' in entry({})));
  assert.equal(entry({ canvasFilm: true }).canvasFilm, true);
});
