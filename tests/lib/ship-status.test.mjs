import test from 'node:test';
import assert from 'node:assert/strict';
import { samePage, blankRuns, isFlat, problemsOf, doneLines, finalFailedLine, finalFailure, lastFailedShip, failedShipLine, recentFailedShipLines } from '../../harness/lib/ship-status.mjs';
import { waiverHint } from '../../harness/lib/waivers.mjs';
import { shipEvent } from '../../harness/lib/run-events.mjs';

const stats = (over = {}) => ({ duration: 6, turns: [{ t: 2 }, { t: 4 }], static: [], ...over });

test('samePage: relative and absolute spellings of one page match', () => {
  assert.ok(samePage('films/a/page.html', `${process.cwd()}/films/a/../a/page.html`));
  assert.ok(!samePage('films/a/page.html', 'films/b/page.html'));
});

test('problemsOf: worst first, seconds named, small things ignored', () => {
  const out = problemsOf(stats({ duration: 10, turns: [{ t: 6.5 }], static: [{ a: 1, b: 2.5, len: 1.5 }, { a: 8, b: 8.5, len: 0.5 }] }), [{ a: 4, b: 4.4 }]);
  assert.deepEqual(out, ['world held 0.0-6.5 s (6.5 s)', 'world held 6.5-10.0 s (3.5 s)', 'static window 1-2.5 s (1.5 s, limit 0.5 s): nothing moves; give the hold an element motion (typing, a counter, a glint), not a camera drift; ' + waiverHint('static-window@1-2.5'), 'blank frame 4.0-4.4 s']);
});

test('problemsOf: measured data-world spans replace the pixel turns', () => {
  const worlds = [{ id: 'a', start: 0, end: 2, ground: '#fff' }, { id: 'b', start: 2, end: 6, ground: '#fff' }];
  const out = problemsOf(stats({ turns: [], duration: 6 }), [], undefined, {}, worlds);
  assert.deepEqual(out, [`world held b 2-6 s (4 s, limit 2 s); ${waiverHint('world-held@2-6')}`]);
});

test('problemsOf: a swap the pixels see is no turn when the worlds are measured, and a page with no worlds keeps the pixel turns', () => {
  const worlds = [{ id: 'a', start: 0, end: 2, ground: '#fff' }, { id: 'b', start: 2, end: 4, ground: '#fff' }];
  assert.deepEqual(problemsOf(stats({ turns: [{ t: 5.5 }], duration: 6 }), [], undefined, {}, worlds), []);
  assert.deepEqual(problemsOf(stats({ turns: [], duration: 6 }), [], undefined, {}, []), ['world held 0.0-6.0 s (6.0 s)']);
});

test('problemsOf: a clean film has none', () => {
  assert.deepEqual(problemsOf(stats(), []), []);
});

test('blankRuns: a flat run inside the film counts, flat edges do not', () => {
  const flat = { flat: true }, live = { flat: false };
  const feats = [...Array(4).fill(flat), ...Array(20).fill(live), ...Array(4).fill(flat), ...Array(20).fill(live), ...Array(4).fill(flat)];
  assert.deepEqual(blankRuns(feats, (f) => f.flat), [{ a: 2.4, b: 2.8 }]);
});

test('isFlat: one colour and level luma only', () => {
  const hist = (top) => Float64Array.from([top, 1 - top, ...Array(14).fill(0)]);
  assert.ok(isFlat({ hist: hist(1), grid: Float64Array.from([0.5, 0.51]) }));
  assert.ok(!isFlat({ hist: hist(0.6), grid: Float64Array.from([0.5, 0.5]) }));
  assert.ok(!isFlat({ hist: hist(1), grid: Float64Array.from([0.1, 0.9]) }));
});

test('doneLines: at most 3 problems and the fresh critique command', () => {
  const job = { id: 'x', page: 'films/x/page.html', startedAt: 0, endedAt: 5000, outputs: ['out/x.mp4'], problems: ['a', 'b', 'c', 'd'] };
  const lines = doneLines(job);
  assert.equal(lines[0], 'job x: done in 5s');
  assert.equal(lines.filter((l) => l.startsWith('  ')).length, 3);
  assert.equal(lines.at(-1), 'next: bin/vawe critique films/x/page.html --fresh');
});

test('doneLines: the ship verdict is PASS only when the judge passes and no measured acceptance row missed', () => {
  const base = { id: 'x', page: 'p.html', startedAt: 0, endedAt: 1000, outputs: ['o.mp4'], problems: [], verdict: ['judge --fresh (final): PASS'] };
  const table = (allGreen) => ({ lines: ['acceptance: 15 of 16 green'], allGreen });
  const pass = doneLines({ ...base, acceptance: table(true) }).join('\n');
  assert.match(pass, /acceptance: 15 of 16 green/);
  assert.match(pass, /ship verdict: PASS/);
  const missed = doneLines({ ...base, acceptance: table(false) }).join('\n');
  assert.match(missed, /ship verdict: FIX \(the judge passed; an acceptance row missed\)/);
  assert.match(missed, /next: fix the acceptance rows above/);
  assert.match(doneLines({ ...base, verdict: ['judge --fresh (final): FIX'], acceptance: table(true) }).join('\n'), /ship verdict: FIX \(the judge did not pass/);
  assert.match(doneLines({ ...base, acceptanceError: 'no ffmpeg' }).join('\n'), /acceptance skipped: no ffmpeg/);
});

test('doneLines: no problems and a skipped check are said plainly', () => {
  assert.match(doneLines({ id: 'x', startedAt: 0, endedAt: 1000, outputs: ['o.mp4'], problems: [] }).join('\n'), /no problems found/);
  assert.match(doneLines({ id: 'x', startedAt: 0, endedAt: 1000, outputs: ['o.mp4'], problems: [], checkError: 'boom' }).join('\n'), /check skipped: boom/);
});

test('a failed final reads its percent and reason back from its own last line', () => {
  const reason = 'slice 1260-1320 (21.00-22.00s) lost its page 4 times (Navigation timeout of 30000 ms exceeded)';
  const log = `\r  capturing 100/200 subframe(s)...\nerror: ${reason}\n${finalFailedLine(96, reason)}\n`;
  assert.deepEqual(finalFailure(log), { pct: 96, reason });
});

test('a final killed without its own line falls back to the last progress and error lines', () => {
  assert.deepEqual(finalFailure('\r  capturing 20768/21504 subframe(s)...', 'exit null'), { pct: 96, reason: 'exit null' });
  assert.deepEqual(finalFailure('error: ffmpeg encode failed (exit 1):', 'exit 1'), { pct: 0, reason: 'ffmpeg encode failed (exit 1):' });
});

test('the newest ship event decides whether the last final failed, and the line says how to resume', () => {
  const failed = { at: '2026-10-02T06:35:00Z', ...shipEvent({ verdict: 'failed', renderS: 960, failure: { pct: 96, reason: 'lost its page', page: 'films/brindle/page.html' } }) };
  assert.equal(failed.failedAt, 96);
  assert.equal(lastFailedShip([{ cmd: 'dev' }, failed]), failed);
  assert.equal(lastFailedShip([failed, { cmd: 'ship', verdict: 'PASS' }]), null);
  assert.equal(lastFailedShip([failed, { cmd: 'dev' }]), failed);
  assert.equal(failedShipLine('brindle', failed), 'error: the last final of brindle failed at 96% (lost its page); bin/vawe ship films/brindle/page.html resumes it');
  const now = Date.parse('2026-10-03T06:00:00Z');
  const films = [{ film: 'brindle', runs: [failed] }, { film: 'old', runs: [{ ...failed, at: '2026-09-01T00:00:00Z' }] }];
  assert.deepEqual(recentFailedShipLines(films, now), [failedShipLine('brindle', failed)]);
});

test('isFlat: grain over one colour is still flat, a faint gradient is flat, a lit ground is not', () => {
  const hist = (top) => Float64Array.from([top, 1 - top]);
  const noisy = Uint8Array.from({ length: 1000 }, (_, i) => 100 + (i % 7));
  assert.ok(isFlat({ hist: hist(0.6), grid: Float64Array.from([0.5, 0.5]), luma: noisy }));
  assert.ok(isFlat({ hist: hist(1), grid: Float64Array.from([0.5, 0.55]) }));
  assert.ok(!isFlat({ hist: hist(1), grid: Float64Array.from([0.3, 0.5]) }));
  const text = Uint8Array.from({ length: 1000 }, (_, i) => (i % 10 === 0 ? 255 : 20));
  assert.ok(!isFlat({ hist: hist(0.6), grid: Float64Array.from([0.5, 0.5]), luma: text }));
});

test('waitCallsLeft counts the wait calls from the capture eta, else from the usual final time', async () => {
  const { waitCallsLeft } = await import('../../harness/lib/ship-status.mjs');
  const cap = 540_000;
  assert.deepEqual(waitCallsLeft({ etaMs: 600_000, elapsedMs: 0, capMs: cap }).calls, 2);
  assert.equal(waitCallsLeft({ etaMs: 60_000, elapsedMs: 0, capMs: cap }).calls, 1);
  const early = waitCallsLeft({ etaMs: null, elapsedMs: 120_000, capMs: cap });
  assert.equal(early.calls, 2);
  assert.match(early.basis, /no pace yet/);
});

test('problemsOf: a canvas film whose pixels move is no held world, one that sits still is', () => {
  const moving = stats({ turns: [], duration: 12, static: [{ a: 3, b: 4, len: 1 }] });
  assert.deepEqual(problemsOf(moving, [], undefined, {}, null, true).filter((p) => p.startsWith('world held')), []);
  assert.deepEqual(problemsOf(moving, []).filter((p) => p.startsWith('world held')), ['world held 0.0-12.0 s (12.0 s)']);
  const still = stats({ turns: [], duration: 12, static: [{ a: 1, b: 11, len: 10 }] });
  assert.deepEqual(problemsOf(still, [], undefined, {}, null, true).filter((p) => p.startsWith('world held')), ['world held 0.0-12.0 s (12.0 s)']);
});
