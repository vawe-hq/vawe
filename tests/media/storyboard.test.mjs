import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { storyboardOf, timecode, settledSecond, splitMove, boardEase, transitionOf } from '../../harness/lib/storyboard.mjs';
import { storyboardHtml, curvePath } from '../../harness/lib/storyboard-html.mjs';
import { easeSamples } from '../../harness/lib/ease-curve.mjs';
import { pageOfFilm } from '../../harness/media/storyboard.mjs';
import { EASE } from '../../core/motion/presets.js';

const brief = fs.readFileSync('films/examples/colour-sting/brief.md', 'utf8');

// The five worlds of colour-sting as the page reports them: warm shows from 0.73, hot already from 1.03 (through the ring's hole).
const spans = [
  { id: 'cold', start: 0.03, end: 0.73, ground: null, readNeed: 0 },
  { id: 'warm', start: 0.73, end: 2.03, ground: null, readNeed: 0 },
  { id: 'hot', start: 1.03, end: 2.77, ground: null, readNeed: 0 },
  { id: 'amber', start: 2.77, end: 4.37, ground: null, readNeed: 0 },
  { id: 'red', start: 4.37, end: 5, ground: null, readNeed: 0 },
];
const cue = (voice, at, role = 'sfx') => ({ synth: voice, role, at, gain: -14 });
const specs = [cue('tap', 0.05), cue('tick', 0.73), cue('swoosh-long', 1.33), cue('sub-thump', 2.77), cue('shimmer', 3.77), cue('tap', 4.37), cue('bed', 0, 'music')];
const read = { duration: 5, spans, specs, anims: [], spectacle: 2.75, signature: 'ease=land', message: 'onsen turns up the colour' };

test('timecode writes minutes, seconds and hundredths', () => {
  assert.equal(timecode(0), '0:00.00');
  assert.equal(timecode(2.756), '0:02.76');
  assert.equal(timecode(75.5), '1:15.50');
});

test('easeSamples reads keywords, cubic-bezier and linear() with and without positions', () => {
  const lin = easeSamples('linear', 4);
  assert.deepEqual(lin.map((p) => p[1]), [0, 0.25, 0.5, 0.75, 1]);
  const bez = easeSamples('cubic-bezier(0.2, 0, 0, 1)', 10);
  assert.equal(bez.length, 11);
  assert.ok(bez[1][1] > 0.1 && bez[10][1] === 1, 'an ease-out leaves 0 fast and ends at 1');
  const stops = easeSamples('linear(0, 0.5 25% 75%, 1)', 4);
  assert.deepEqual(stops.map((p) => +p[1].toFixed(3)), [0, 0.5, 0.5, 0.5, 1]);
  const spaced = easeSamples('linear(0, 0.2, 1)', 2);
  assert.deepEqual(spaced.map((p) => p[1]), [0, 0.2, 1]);
  assert.equal(easeSamples('steps(4)'), null);
});

test('the curve of a named ease ends on 1 and an overshoot widens the drawing', () => {
  const pts = easeSamples(EASE.pop, 24);
  assert.equal(pts.at(-1)[1], 1);
  assert.ok(Math.max(...pts.map((p) => p[1])) > 1, 'pop goes past its end value');
  const flat = curvePath(easeSamples('linear', 4));
  const over = curvePath(pts);
  assert.ok(over.y1 > flat.y1, 'the 1 line moves down when the curve overshoots');
});

test('settledSecond is after the last entrance of the world, else inside its span', () => {
  const span = { id: 'a', start: 1, end: 3 };
  assert.equal(settledSecond(span, [{ world: 'a', start: 1, end: 1.8, ease: 'linear' }]), 1.85);
  assert.equal(settledSecond(span, []), 2);
});

test('storyboardOf gives one shot per world with timecodes and durations from the page', () => {
  const b = storyboardOf({ film: 'colour-sting', read, brief });
  assert.deepEqual(b.shots.map((s) => s.id), ['cold', 'warm', 'hot', 'amber', 'red']);
  const warm = b.shots[1];
  assert.deepEqual([warm.in, warm.out, warm.duration], ['0:00.73', '0:02.03', 1.3]);
  assert.equal(warm.n, 2);
});

test('cues go to the shot that shows them, a cue on a boundary to the shot it opens, and a music bed is kept apart', () => {
  const b = storyboardOf({ film: 'x', read, brief });
  const names = (id) => b.shots.find((s) => s.id === id).cues.map((c) => `${c.voice}@${c.at}`);
  assert.deepEqual(names('cold'), ['tap@0.05']);
  assert.deepEqual(names('warm'), ['tick@0.73', 'swoosh-long@1.33']);
  assert.deepEqual(names('amber'), ['sub-thump@2.77', 'shimmer@3.77']);
  assert.equal(b.bed.length, 1);
  assert.equal(b.cues.length, 6);
});

test('the spectacle belongs to the shot it lands in, a frame early counts', () => {
  const b = storyboardOf({ film: 'x', read, brief });
  assert.deepEqual(b.spectacle, { at: 2.75, world: 'amber' });
  assert.equal(storyboardOf({ film: 'x', read: { ...read, spectacle: null }, brief }).spectacle, null);
});

test('the brief fills the action, the move into the shot, the ease named in the Board and the handoff', () => {
  const b = storyboardOf({ film: 'x', read, brief });
  const [cold, warm, , amber] = b.shots;
  assert.match(cold.action, /pulls back and turns/);
  assert.equal(cold.move, null);
  assert.equal(warm.move, 'match-cut');
  assert.match(warm.moveDetail, /holds its place/);
  assert.equal(amber.ease.name, 'pop');
  assert.equal(amber.ease.source, 'board');
  assert.equal(warm.ease.name, 'land');
  assert.equal(warm.ease.source, 'signature');
  assert.equal(b.transitions.length, 4);
  assert.equal(b.transitions[0].name, 'graphic match');
  assert.equal(b.transitions[0].hard, true);
  assert.equal(b.transitions[1].name, 'camera through');
  assert.equal(b.transitions[1].length, 1);
  assert.deepEqual(b.transitions[1].band, [1, 2]);
  assert.deepEqual(b.transitions[3].band, [3.42, 4.37]);
});

test('an ease the page animates wins over the Board and the signature', () => {
  const anims = [{ world: 'warm', id: 'in', start: 0.8, end: 1.4, ease: 'cubic-bezier(0.2, 0, 0, 1)' }];
  const b = storyboardOf({ film: 'x', read: { ...read, anims }, brief });
  assert.equal(b.shots[1].ease.source, 'page');
  assert.equal(b.shots[1].ease.name, 'cubic-bezier(0.2, 0, 0, 1)');
  assert.equal(b.shots[1].ease.points.length, 25);
});

test('a named ease is recognised by its curve, not its string', () => {
  const anims = [{ world: 'warm', id: 'in', start: 0.8, end: 1.4, ease: EASE.nudge }];
  assert.equal(storyboardOf({ film: 'x', read: { ...read, anims }, brief: null }).shots[1].ease.name, 'nudge');
});

test('a film without a brief keeps the page fields and leaves the brief-only ones out', () => {
  const b = storyboardOf({ film: 'x', read, brief: null });
  assert.equal(b.hasBrief, false);
  assert.ok(b.shots.every((s) => s.action === null && s.move === null && s.note === null));
  assert.equal(b.shots[1].ease.source, 'signature');
  assert.deepEqual(b.transitions[1].band, [1.03, 2.03], 'the length is the overlap of the two shots in the page');
  assert.equal(b.transitions[1].planned, false);
  assert.equal(b.transitions[0].hard, true);
  assert.equal(b.motionPass, null);
});

test('the Motion pass prose of a brief becomes one board note, cut at a word', () => {
  const b = storyboardOf({ film: 'x', read, brief });
  assert.ok(b.motionPass.startsWith('bin/vawe dev'));
  assert.ok(b.motionPass.length <= 285 && /\.\.\.$/.test(b.motionPass));
});

test('Motion pass table rows become notes on the shot their cut names; placeholder rows add none', () => {
  const table = `${brief.split('## Motion pass')[0]}## Motion pass\n\n| cut | read | fixed |\n|---|---|---|\n| warm to hot | ring reads flat | added overshoot |\n| hot to amber | pending | pending |\n`;
  const b = storyboardOf({ film: 'x', read, brief: table });
  assert.equal(b.shots[1].note, 'ring reads flat / added overshoot');
  assert.equal(b.shots.filter((s) => s.note).length, 1);
});

test('splitMove reads "name: detail", "name, detail" and markdown links', () => {
  assert.deepEqual(splitMove('match-cut: the ring holds'), { name: 'match-cut', detail: 'the ring holds' });
  assert.deepEqual(splitMove('[speed-ramp](../../prompts/moves/speed-ramp.md), x axis'), { name: 'speed-ramp', detail: 'x axis' });
  assert.deepEqual(splitMove('whip'), { name: 'whip', detail: null });
});

test('boardEase finds EASE.name and "`name` curve" and ignores words that are no ease', () => {
  assert.equal(boardEase({ overshoots: 'the landing on the `pop` curve' }), 'pop');
  assert.equal(boardEase({ overshoots: 'the line on EASE.nudge', move: '' }), 'nudge');
  assert.equal(boardEase({ overshoots: 'none', move: 'whip in a `foo` curve' }), null);
});

test('transitionOf prefers the Board length, then the page overlap, and a zero length is a hard cut', () => {
  const [a, b] = [{ id: 'a', start: 0, end: 2 }, { id: 'b', start: 1.5, end: 4 }];
  assert.equal(transitionOf([a, b], 0, null).length, 0.5);
  assert.equal(transitionOf([a, b], 0, { at: 1, end: 2, handoff: 'flood: glow', overlap: 0 }).length, 1);
  const hard = transitionOf([a, { ...b, start: 2 }], 0, { at: 2, end: null, overlap: 0, handoff: 'deliberate cut: x' });
  assert.deepEqual([hard.hard, hard.band, hard.name], [true, null, 'deliberate cut']);
});

test('the page holds every shot, its image, timecodes, cue and handoff, and is one file that opens from disk', () => {
  const b = storyboardOf({ film: 'colour-sting', read, brief });
  const images = Object.fromEntries(b.shots.map((s) => [s.id, `colour-sting-storyboard/0${s.n}-${s.id}.jpg`]));
  const html = storyboardHtml(b, { images, fontCss: '' });
  for (const s of b.shots) {
    assert.ok(html.includes(`id="shot-${s.id}"`));
    assert.ok(html.includes(images[s.id]));
    assert.ok(html.includes(s.in) && html.includes(s.out));
  }
  assert.ok(html.includes('graphic match') && html.includes('swoosh-long') && html.includes('big moment 2.75 s'));
  assert.ok(html.includes('straight cut') && html.includes('1.00 s'));
  assert.ok(html.includes('localStorage'), 'sticky notes are kept in the browser');
  assert.ok(!/<script[^>]+src=|<link[^>]+href=|https?:\/\//.test(html), 'no external file or library');
});

test('text from a brief is escaped in the page', () => {
  const b = storyboardOf({ film: 'x', read, brief: null });
  b.shots[0].action = '<img src=x onerror=alert(1)>';
  const html = storyboardHtml(b, { images: Object.fromEntries(b.shots.map((s) => [s.id, 'a.jpg'])) });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
});

test('a draft finds its page by the film name', () => {
  assert.ok(pageOfFilm('colour-sting').endsWith('films/examples/colour-sting/page.html'));
  assert.equal(pageOfFilm('no-such-film'), null);
});

test('the words a person reads on the board are plain: no world, spectacle, handoff, hard cut or rhythm', () => {
  const b = storyboardOf({ film: 'colour-sting', read, brief: null });
  const html = storyboardHtml(b, { images: Object.fromEntries(b.shots.map((s) => [s.id, 'a.jpg'])) });
  const visible = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!/\b(world|spectacle|handoff|hard cut|rhythm|shots?)\b/i.test(visible), visible.match(/\b(world|spectacle|handoff|hard cut|rhythm|shots?)\b/i)?.[0]);
  assert.ok(/big moment/.test(visible) && /scene change/.test(visible) && /5 scenes/.test(visible));
});
