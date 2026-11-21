// Every trick the loophole audit found, as a page in tests/fixtures/tricks/<name>/page.html: the check for it must not go green on the
// trick page, and the honest page next to it must pass. Needs Chrome and ffmpeg.
//   node --test tests/media/tricks.test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openPage, resolveFrame, settle, readPageMeta, probePage, pageAdvice } from '../../harness/media/render-page.mjs';
import { heldWorlds } from '../../harness/lib/worlds.mjs';
import { pageAuthoring } from '../../harness/lib/motion-stamp.mjs';
import { tailMoving } from '../../harness/lib/tail-motion.mjs';
import { waiverProblems } from '../../harness/lib/waivers.mjs';
import { lockedSpectacle } from '../../harness/lib/board.mjs';
import { spectacleOf } from '../../harness/lib/board.mjs';
import { readBrief } from '../../harness/lib/brief-tables.mjs';
import { balanceLines } from '../../harness/lib/cue-balance.mjs';
import fs from 'node:fs';

const DIR = path.resolve('tests/fixtures/tricks');
const pagePath = (name) => path.join(DIR, name, 'page.html');
const read = new Map();

async function readFixture(name) {
  if (read.has(name)) return read.get(name);
  const file = pagePath(name);
  const opened = await openPage(file, resolveFrame(file));
  try {
    await opened.page.goto(opened.url, { waitUntil: 'load' });
    await settle(opened.page);
    const dur = Number(readPageMeta(file, 'duration'));
    const probed = await probePage(opened.page, dur, file);
    const audio = opened.page.evaluate(() => document.querySelector('audio') !== null).then(async (has) => {
      if (!has) return null;
      const { readPageAudio } = await import('../../harness/media/page-audio.mjs');
      try { return { read: await readPageAudio(opened.page, { pagePath: file }) }; } catch (e) { return { error: String(e.message) }; }
    });
    const result = { ...probed, advice: pageAdvice(file, probed), dur, audio: await audio };
    read.set(name, result);
    return result;
  } finally { await opened.close(); }
}

const linesOf = (r) => [...r.advice.text, ...r.advice.lines];
const has = (r, re) => linesOf(r).some((l) => re.test(l));

test('honest: a lit ground, element motion in every hold and a moving tail pass every trick check', async () => {
  const r = await readFixture('honest');
  assert.ok(!has(r, /living-ground|constant-camera|read as copy|exempt from the text checks|waiver "|board:/), linesOf(r).join('\n'));
  assert.equal(tailMoving(r.probe.tail), true);
  assert.deepEqual(heldWorlds(r.probe.worlds, 2, pageAuthoring(pagePath('honest'))), []);
});

test('a slow camera ease on every hold is the house default, not a constant camera; it still does not keep the tail alive', async () => {
  const r = await readFixture('drift-every-hold');
  assert.ok(!has(r, /constant-camera/));
  assert.equal(tailMoving(r.probe.tail), false);
});

test('trick: a grain overlay and a faint full-frame gradient over a flat ground are still a flat ground', async () => {
  for (const name of ['grain-overlay', 'faint-gradient']) {
    const r = await readFixture(name);
    assert.ok(has(r, /living-ground/), name);
  }
});

test('trick: copy hidden under aria-hidden is checked as copy and named with its count', async () => {
  const r = await readFixture('hidden-text');
  assert.ok(has(r, /^3 of 3 text nodes carry aria-hidden or data-chrome but read as copy/));
});

test('honest: small repeated aria-hidden labels are texture and are not named', async () => {
  const r = await readFixture('texture-text');
  assert.ok(!has(r, /read as copy|exempt from the text checks/), linesOf(r).join('\n'));
});

test('trick: one beat split into two data-world elements with the same content is one held world', async () => {
  const r = await readFixture('split-world');
  const found = heldWorlds(r.probe.worlds, 2, pageAuthoring(pagePath('split-world')));
  assert.equal(found.length, 1);
  assert.match(found[0].text, /^world held a\+b /);
});

test('honest: a world held 2.5 s is waived by a scoped waiver that names its world and its measures, and by nothing less', async () => {
  const r = await readFixture('honest-waiver');
  const authoring = pageAuthoring(pagePath('honest-waiver'));
  assert.deepEqual(waiverProblems(authoring), []);
  assert.deepEqual(heldWorlds(r.probe.worlds, 2, authoring), []);
  assert.equal(heldWorlds(r.probe.worlds, 2, {}).length, 1, 'without the waiver the world is held');
});

test('trick: generic, copied, retired and dead waivers are refused with a message each', async () => {
  const lines = waiverProblems(pageAuthoring(pagePath('generic-waivers')));
  assert.equal(lines.length, 7);
  assert.match(lines.join('\n'), /"dead-air@0-3" waives nothing/);
  assert.match(lines.join('\n'), /"glow" waives nothing/);
  assert.match(lines.join('\n'), /"static-window@0\.5-1\.5" refused: the reason is generic/);
  assert.match(lines.join('\n'), /"world-held@1-2" refused: the reason is under 12 characters/);
  assert.equal(lines.filter((l) => /same reason is used for 3 waivers/.test(l)).length, 3);
});

test('trick: a spectacle meta moved off the Board\'s second is named and the checks keep the Board\'s second', async () => {
  const r = await readFixture('moved-meta');
  assert.ok(has(r, /board: the Spectacle is at 2 s but <meta name="spectacle"> says 0\.5 s; the spectacle checks read 2 s/));
  const html = fs.readFileSync(pagePath('moved-meta'), 'utf8');
  assert.equal(lockedSpectacle(readBrief(pagePath('moved-meta')), spectacleOf(html)), 2);
});

test('trick: a synth drone is refused, a uniform data-gain shift is named, default gains are clean', async () => {
  const drone = await readFixture('synth-drone');
  assert.match(drone.audio.error, /synth beds are banned/);
  const { measureMixLevel } = await import('../../harness/media/page-audio.mjs');
  const shifted = await readFixture('uniform-gain');
  const level = measureMixLevel({ specs: shifted.audio.read.specs, duration: shifted.dur });
  assert.match(balanceLines(level.cues.filter((c) => c.role === 'sfx')).join('\n'), /^all 3 cues carry data-gain -6 dB from their voice defaults|all 3 cues carry data-gain -[56] dB/);
  const honest = await readFixture('default-gain');
  const clean = measureMixLevel({ specs: honest.audio.read.specs, duration: honest.dur });
  assert.deepEqual(balanceLines(clean.cues.filter((c) => c.role === 'sfx')), []);
});

test('trick: a looped drone file is a bed that never changes; a bed that changes passes', async () => {
  const { measureMixLevel } = await import('../../harness/media/page-audio.mjs');
  const { bedLine } = await import('../../harness/lib/bed-motion.mjs');
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-bed-'));
  try {
    const make = (name, expr) => {
      const file = path.join(dir, name);
      const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `aevalsrc=${expr}:s=44100:d=20`, file]);
      assert.equal(r.status, 0, String(r.stderr));
      return file;
    };
    const drone = make('drone.wav', "'0.3*sin(2*PI*110*t)+0.2*sin(2*PI*165*t)'");
    const music = make('music.wav', "'0.3*sin(2*PI*t*(220+60*floor(mod(t,2)/0.5)))'");
    const spec = (src) => ({ src, at: 0, gain: -12, gainSet: true, defaultGain: 0, fadeIn: 0, fadeOut: 0, trim: 0, trimEnd: null, duck: null, role: 'music' });
    const droneBed = measureMixLevel({ specs: [spec(drone)], duration: 6 }).beds[0];
    assert.match(bedLine(droneBed), /keeps one spectrum for the whole film/);
    const musicBed = measureMixLevel({ specs: [spec(music)], duration: 6 }).beds[0];
    assert.equal(bedLine(musicBed), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
