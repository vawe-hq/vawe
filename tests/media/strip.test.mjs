import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { spreadIndexes, stripProblem, stripFpsProblem, stripWindow, worldCuts, shotCuts, motionRead, motionLines, energyLines, filmNameOf, holdBefore, holdLine, holdsSummary, withTransitions, cutHolds, transitionLine } from '../../harness/media/see/strip-math.mjs';
import { videoTransitions } from '../../harness/media/see/transitions.mjs';
import { computeEnergy } from '../../harness/media/see/core.mjs';
import { captureEtaMs, firstCapture } from '../../harness/lib/ship-status.mjs';
import { compareProblem } from '../../harness/media/compare-frames.mjs';

const series = (from, values) => values.map((v, i) => ({ t: +(from + i * 0.1).toFixed(3), v }));
const FLOOR = 0.6;

test('stripWindow: centred on the moment, kept inside the film', () => {
  assert.deepEqual(stripWindow(8.4, 1, 20), { from: 7.9, to: 8.9 });
  assert.deepEqual(stripWindow(0.2, 1, 20), { from: 0, to: 1 });
  assert.deepEqual(stripWindow(19.9, 1, 20), { from: 19, to: 20 });
  assert.deepEqual(stripWindow(1, 4, 2), { from: 0, to: 2 });
});

test('stripProblem: names the flag at fault', () => {
  assert.equal(stripProblem({ at: '8.4', cuts: false, span: 1, fps: 8 }), null);
  assert.equal(stripProblem({ at: undefined, cuts: true, span: 1, fps: 8 }), null);
  assert.match(stripProblem({ cuts: false, span: 1, fps: 8 }), /--at/);
  assert.match(stripProblem({ at: '2', cuts: true, span: 1, fps: 8 }), /not both/);
  assert.match(stripProblem({ at: 'x', cuts: false, span: 1, fps: 8 }), /not a number/);
  assert.match(stripProblem({ at: '2', cuts: false, span: 0, fps: 8 }), /--span/);
  assert.equal(stripProblem({ at: '2', cuts: false, span: 1, fps: 60 }), null);
  assert.equal(stripProblem({ at: '2', cuts: false, span: 4, fps: 0.5 }), null);
  assert.match(stripProblem({ at: '2', cuts: false, span: 1, fps: 0 }), /--fps/);
});

test('stripFpsProblem: the cap is the fps of the video read', () => {
  assert.equal(stripFpsProblem(30, 30), null);
  assert.equal(stripFpsProblem(60, 60), null);
  assert.equal(stripFpsProblem(30, 29.97), null);
  assert.match(stripFpsProblem(60, 30), /more than the 30 fps this video has/);
  assert.match(stripFpsProblem(31, 24), /at most 24/);
});

test('strip --fps 60: a 30 fps draft refuses, a 60 fps mp4 extracts 60 frames a second', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-fps-'));
  const mk = (name, rate) => {
    const f = path.join(dir, name);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `testsrc=size=160x90:rate=${rate}:duration=2`, '-pix_fmt', 'yuv420p', f]);
    return f;
  };
  const run = (file, fps) => spawnSync('node', ['harness/media/see.mjs', file, '--moment', '1', '--span', '0.2', '--fps', String(fps), '--out', path.join(dir, 'o')], { encoding: 'utf8' });
  const draft = run(mk('d-draft.mp4', 30), 60);
  assert.notEqual(draft.status, 0);
  assert.match(draft.stderr + draft.stdout, /more than the 30 fps this video has/);
  const final = run(mk('f.mp4', 60), 60);
  assert.equal(final.status, 0, final.stderr);
  assert.match(final.stdout, /frames every 0\.017 s/);
});

test('worldCuts: the middle between a world ending and the next starting, never-shown worlds skipped', () => {
  const spans = [
    { id: 's2', start: 3.4, end: 6 },
    { id: 's1', start: 0, end: 3 },
    { id: 'ghost', start: null, end: null },
    { id: 's3', start: 5.8, end: 9 },
  ];
  assert.deepEqual(worldCuts(spans), [{ at: 3.2, from: 's1', to: 's2' }, { at: 5.9, from: 's2', to: 's3' }]);
  assert.deepEqual(worldCuts([{ id: 'only', start: 0, end: 5 }]), []);
});

test('shotCuts: one cut at the start of each shot after the first', () => {
  assert.deepEqual(shotCuts([{ start: 0 }, { start: 1.5 }, { start: 4 }]), [{ at: 1.5, from: 'shot 1', to: 'shot 2' }, { at: 4, from: 'shot 2', to: 'shot 3' }]);
  assert.deepEqual(shotCuts([{ start: 0 }]), []);
});

test('motionRead: a move that starts and settles inside the strip', () => {
  const r = motionRead(series(8, [0.1, 0.1, 4, 6, 3, 1.5, 0.7, 0.2, 0.1, 0.1]), 8, 9, FLOOR);
  assert.equal(r.moving, true);
  assert.equal(r.start, 8.2);
  assert.equal(r.peak, 6);
  assert.equal(r.peakAt, 8.3);
  assert.equal(r.settle, 8.7);
  assert.equal(r.settled, true);
  assert.equal(r.startedBefore, false);
  assert.equal(r.bursts.length, 1);
});

test('motionRead: already moving at the strip start, still moving at its end', () => {
  const r = motionRead(series(2, [5, 5, 4, 4, 3]), 2, 2.5, FLOOR);
  assert.equal(r.startedBefore, true);
  assert.equal(r.settled, false);
});

test('motionRead: a dip of under 0.2 s stays one burst, a longer dip makes two', () => {
  assert.equal(motionRead(series(0, [0, 5, 0.1, 5, 0, 0, 0, 0, 0, 0]), 0, 1, FLOOR).bursts.length, 1);
  const two = motionRead(series(0, [0, 5, 0.1, 0.1, 5, 0, 0, 0, 0, 0]), 0, 1, FLOOR);
  assert.equal(two.bursts.length, 2);
  assert.deepEqual(two.bursts, [{ t0: 0.1, t1: 0.2 }, { t0: 0.4, t1: 0.5 }]);
});

test('motionRead: nothing above the floor is no motion; no samples is null', () => {
  assert.deepEqual(motionRead(series(0, [0.1, 0.3, 0.2]), 0, 0.3, FLOOR), { moving: false, peak: 0.3 });
  assert.equal(motionRead([], 0, 1, FLOOR), null);
});

test('motionLines and energyLines print the numbers an agent acts on', () => {
  const energy = series(8, [0.1, 0.1, 4, 6, 3, 1.5, 0.7, 0.2, 0.1, 0.1]);
  const lines = motionLines(motionRead(energy, 8, 9, FLOOR), FLOOR);
  assert.equal(lines[0], 'motion: starts 8.20 s, peaks 6 at 8.30 s, settles 8.70 s; 1 burst');
  assert.match(motionLines({ moving: false, peak: 0.2 }, FLOOR)[0], /nothing moves/);
  assert.equal(energyLines(energy, 8, 8.3, { compact: true })[0], 'energy per 0.1 s from 8.0 s: 0.1 0.1 4.0');
  assert.equal(energyLines(energy, 8, 8.3).length, 4);
});

test('filmNameOf: draft and web suffixes name the same film', () => {
  assert.equal(filmNameOf('out/s11a-loomline.mp4'), 's11a-loomline');
  assert.equal(filmNameOf('/x/out/s11a-loomline-draft.mp4'), 's11a-loomline');
  assert.equal(filmNameOf('out/a.web.mp4'), 'a');
});

test('compareProblem accepts --at cuts', () => {
  assert.equal(compareProblem({ ours: 'out/a.mp4', at: 'cuts' }), null);
  assert.match(compareProblem({ ours: 'out/a.mp4', at: 'soon' }), /--at/);
});

test('captureEtaMs counts only time since the first capture line', () => {
  const first = { done: 10, total: 1000 };
  assert.equal(captureEtaMs({ first, firstAt: 0, done: 110, total: 1000, now: 10_000 }), 89_000);
  assert.equal(captureEtaMs({ first, firstAt: 0, done: 10, total: 1000, now: 1000 }), null);
});

test('captureEtaMs: a long set-up before the capture does not inflate the estimate', () => {
  const setupMs = 600_000;
  const first = { done: 0, total: 1000 };
  const eta = captureEtaMs({ first, firstAt: setupMs, done: 500, total: 1000, now: setupMs + 60_000 });
  assert.equal(eta, 60_000);
});

test('firstCapture reads the first progress line of a render log', () => {
  assert.deepEqual(firstCapture('checks ok\n\r  capturing 12/3400 subframe(s)...\r  capturing 30/3400 subframe(s)...'), { done: 12, total: 3400 });
  assert.equal(firstCapture('page load'), null);
});

test('holdBefore measures the still run before a cut, on whole samples, leaving out the samples of both cuts', () => {
  const at = (t, v) => ({ t, v });
  const energy = [at(0, 2), at(0.1, 2), at(0.2, 2), at(0.3, 0.2), at(0.4, 0.1), at(0.5, 0.1), at(0.6, 9), at(0.7, 0.1), at(0.8, 0.1), at(0.9, 3)];
  assert.deepEqual(holdBefore(energy, 0.6, 0.6), { holdS: 0.3, whole: false });
  assert.deepEqual(holdBefore(energy, 0.65, 0.6), { holdS: 0.3, whole: false });
  assert.deepEqual(holdBefore(energy, 0.95, 0.6, 0.6), { holdS: 0.2, whole: true });
  assert.deepEqual(holdBefore(energy, 0.1, 0.6), { holdS: 0, whole: false });
  assert.equal(holdBefore(energy, 0.75, 0.6, 0.6), null);
  assert.equal(holdLine(null), 'hold before the cut: not measured, the shot is under 0.2 s');
  assert.equal(holdLine({ holdS: 0, whole: false }), 'hold before the cut: none, the cut lands on motion');
  assert.equal(holdLine({ holdS: 0.4, whole: false }), 'hold before the cut: 0.40 s');
  const [count, ref] = holdsSummary([{ holdS: 0.4 }, { holdS: 0 }, null]);
  assert.match(count, /^pauses: 1 of 2 measured cuts hold 0\.3 s or more/);
  assert.match(ref, /^for comparison, the shot cuts of 22 reference films/);
});

test('withTransitions: the cut takes the start and end of the shot change near it, none leaves it at its own time', () => {
  const cuts = [{ at: 1.1, from: 'a', to: 'b' }, { at: 4, from: 'b', to: 'c' }];
  const [fade, none] = withTransitions(cuts, [{ startT: 0.6, endT: 1.4, type: 'crossfade' }, { startT: 9, endT: 9, type: 'cut' }]);
  assert.deepEqual([fade.start, fade.end, fade.kind, fade.from], [0.6, 1.4, 'crossfade', 'a']);
  assert.deepEqual([none.start, none.end, none.kind], [4, 4, null]);
});

test('cutHolds: a world cut inside a crossfade holds up to where the fade starts, not up to the midpoint', () => {
  const fadeEnergy = series(0, [0, 0, 0, 0, 0, 0, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0, 0]);
  const [mid] = [{ at: 0.9, from: 'a', to: 'b' }];
  assert.equal(holdBefore(fadeEnergy, mid.at, FLOOR).holdS, 0.9);
  const cuts = withTransitions([mid], [{ startT: 0.6, endT: 1.3, type: 'crossfade' }]);
  assert.deepEqual(cutHolds(fadeEnergy, cuts, FLOOR), [{ holdS: 0.6, whole: true }]);
});

test('cutHolds: the hold after a cut starts at the end of its shot change', () => {
  const energy = series(0, [9, 9, 9, 0, 0, 0, 0, 0, 9, 9]);
  const cuts = withTransitions([{ at: 0.1, from: 'a', to: 'b' }, { at: 0.8, from: 'b', to: 'c' }], [{ startT: 0, endT: 0.3, type: 'wipe' }]);
  assert.equal(cutHolds(energy, cuts, FLOOR)[1].holdS, 0.4);
});

test('transitionLine: a dissolve is named with its length, a hard cut says nothing', () => {
  assert.match(transitionLine({ kind: 'crossfade', start: 2.03, end: 3.6 }), /^a dissolve of 1\.57 s, from 2\.03 s/);
  assert.match(transitionLine({ kind: 'dip', start: 1, end: 1.5 }), /^a dissolve of 0\.50 s/);
  assert.match(transitionLine({ kind: 'wipe', start: 1, end: 1.4 }), /^a transition of 0\.40 s, from 1\.00 s \(wipe\)/);
  assert.equal(transitionLine({ kind: 'cut', start: 1, end: 1 }), null);
  assert.equal(transitionLine({ kind: null, start: 1, end: 1 }), null);
});

test('a slow low-contrast dissolve is found as a crossfade and its energy stays under the floor, so the hold stops at its first frame', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-dissolve-'));
  const still = (src, name) => {
    const f = path.join(dir, name);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `${src}=size=160x90:rate=30`, '-frames:v', '1', f]);
    return f;
  };
  const [a, b] = [still('testsrc', 'a.png'), still('testsrc2', 'b.png')];
  const video = path.join(dir, 'dissolve.mp4');
  const dim = 'eq=contrast=0.25:brightness=-0.1';
  execFileSync('ffmpeg', ['-v', 'error', '-framerate', '30', '-loop', '1', '-t', '5', '-i', a, '-framerate', '30', '-loop', '1', '-t', '5', '-i', b,
    '-filter_complex', `[0]${dim}[a];[1]${dim}[b];[a][b]xfade=transition=fade:duration=1.6:offset=2,format=yuv420p`, video]);
  const [fade] = videoTransitions(video);
  assert.equal(fade.type, 'crossfade');
  assert.ok(Math.abs(fade.startT - 2) < 0.1 && Math.abs(fade.endT - 3.6) < 0.1, JSON.stringify(fade));
  const energy = computeEnergy(video);
  assert.ok(Math.max(...energy.filter((p) => p.t >= 2.1 && p.t < 3.5).map((p) => p.v)) < FLOOR);
  const [cut] = withTransitions([{ at: 2.8, from: 'a', to: 'b' }], [fade]);
  assert.ok(Math.abs(cutHolds(energy, [cut], FLOOR)[0].holdS - 2) < 0.15);
  assert.ok(holdBefore(energy, 2.8, FLOOR).holdS > 2.5);
});

test('withTransitions gives a shot change to its nearest cut, so a hard cut 0.4 s earlier cannot take it', () => {
  const cuts = [{ at: 1.0, from: 'a', to: 'b' }, { at: 1.45, from: 'b', to: 'c' }];
  const [a, b] = withTransitions(cuts, [{ startT: 1.4, endT: 1.5, type: 'wipe' }]);
  assert.equal(a.kind, null);
  assert.equal(a.start, 1.0);
  assert.equal(b.kind, 'wipe');
  assert.equal(b.start, 1.4);
});

test('a page input reads the draft the last dev wrote, wherever --out put it', async () => {
  const { resolveInput } = await import('../../harness/media/see/input.mjs');
  const { appendRun } = await import('../../harness/lib/runlog.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-lastdraft-'));
  const cwd = process.cwd();
  process.chdir(root);
  try {
    fs.mkdirSync('films/f', { recursive: true });
    fs.writeFileSync('films/f/page.html', '<html></html>');
    assert.equal((await resolveInput('films/f/page.html')).draftMissing, true);
    fs.mkdirSync('elsewhere');
    fs.writeFileSync('elsewhere/draft.mp4', '');
    const draft = path.resolve('elsewhere/draft.mp4');
    appendRun('films/f/page.html', { cmd: 'dev', file: draft });
    const found = await resolveInput('films/f/page.html');
    assert.equal(found.video, draft);
    assert.equal(found.draftMissing, false);
  } finally {
    process.chdir(cwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('spreadIndexes keeps the first and last cut and spreads the rest; every cut when the limit is not under the count', () => {
  assert.deepEqual(spreadIndexes(24, 8), [0, 3, 7, 10, 13, 16, 20, 23]);
  assert.deepEqual(spreadIndexes(5, 8), [0, 1, 2, 3, 4]);
  assert.deepEqual(spreadIndexes(5, 5), [0, 1, 2, 3, 4]);
  assert.deepEqual(spreadIndexes(5, undefined), [0, 1, 2, 3, 4]);
  assert.deepEqual(spreadIndexes(5, 1), [2]);
  assert.deepEqual(spreadIndexes(0, 3), []);
});

test('stripProblem: --limit is a whole number of 1 or more and needs --cuts', () => {
  assert.equal(stripProblem({ cuts: true, span: 1, fps: 8, limit: 8 }), null);
  assert.match(stripProblem({ cuts: true, span: 1, fps: 8, limit: 0 }), /whole number/);
  assert.match(stripProblem({ cuts: true, span: 1, fps: 8, limit: 2.5 }), /whole number/);
  assert.match(stripProblem({ cuts: true, span: 1, fps: 8, limit: NaN }), /whole number/);
  assert.match(stripProblem({ at: '2', span: 1, fps: 8, limit: 3 }), /needs --cuts/);
});
