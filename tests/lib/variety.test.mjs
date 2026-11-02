import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dialRanges, signatureSection } from '../../harness/lib/signature.mjs';
import { DIAL_VALUES, valueKeys, namesBrandKit, recentSignatures, unusedByDial, unusedLine, repeatAdvice, varietyFor, recentFromDisk } from '../../harness/lib/variety.mjs';
import { newFilm, newFilmLines } from '../../harness/cli/new.mjs';

const dev = (film, at, signature) => ({ film, runs: [{ at, cmd: 'dev', signature }] });
const sigs = (...rows) => rows.map(([film, signature]) => ({ film, at: film, signature }));

test('the closed dial values stay inside the range text of the rule that owns the dial', () => {
  for (const d of dialRanges().filter((x) => DIAL_VALUES[x.dial])) {
    for (const value of DIAL_VALUES[d.dial]) assert.ok(d.range.includes(value) || fs.readFileSync(d.file, 'utf8').includes(value), `${d.dial} ${value}`);
  }
});

test('valueKeys: exact for band and ease, by word for the free-text dials, raw otherwise', () => {
  assert.deepEqual(valueKeys('ease', 'landSoft'), ['landSoft']);
  assert.deepEqual(valueKeys('ease', 'land'), ['land']);
  assert.deepEqual(valueKeys('thread', 'a caret object, plus rhythm'), ['object', 'rhythm']);
  assert.deepEqual(valueKeys('palette', 'Warm Neutral with a red accent'), ['warm neutral']);
  assert.deepEqual(valueKeys('stagger', '45'), ['45']);
});

test('recentSignatures takes the newest dev signature, falls back to the page meta, skips the film itself and caps at the limit', () => {
  const films = [
    dev('a', '2026-10-01T00:00:00Z', { band: 'energy' }),
    { film: 'b', runs: [{ at: '2026-10-02T00:00:00Z', cmd: 'dev', signature: {} }, { at: '2026-10-02T01:00:00Z', cmd: 'ship' }] },
    { film: 'c', runs: [{ at: '2026-09-01T00:00:00Z', cmd: 'dev' }] },
    { film: 'd', runs: [{ at: '2026-10-03T00:00:00Z', cmd: 'new', signature: { offered: {}, chosen: {} } }] },
    { film: 'a-old', runs: [{ at: '2026-08-01T00:00:00Z', cmd: 'dev', signature: { band: 'gravity' } }, { at: '2026-08-02T00:00:00Z', cmd: 'dev', signature: { band: 'cinematic' } }] },
  ];
  const meta = (film) => ({ b: 'band=gravity; ease=swap' }[film] ?? null);
  const out = recentSignatures(films, meta, {});
  assert.deepEqual(out.map((s) => [s.film, s.signature.band]), [['b', 'gravity'], ['a', 'energy'], ['a-old', 'cinematic']]);
  assert.deepEqual(recentSignatures(films, meta, { skip: 'b' }).map((s) => s.film), ['a', 'a-old']);
  assert.equal(recentSignatures(films, meta, { limit: 1 }).length, 1);
});

test('unused values per dial, and the line that names them; brand-exempt dials and an empty history say nothing', () => {
  const recent = sigs(['a', { band: 'energy', ease: 'land', palette: 'mono plus accent' }], ['b', { band: 'gravity', ease: 'landSoft' }]);
  const unused = unusedByDial(recent);
  assert.deepEqual(unused.band, ['professional', 'cinematic']);
  assert.ok(!unused.ease.includes('land') && !unused.ease.includes('landSoft') && unused.ease.includes('settle'));
  assert.deepEqual(unused.palette, ['warm neutral', 'cool neutral', 'saturated', 'duotone']);
  assert.match(unusedLine(unused), /^unused so far: band professional, cinematic; ease .*settle.*; seam soft, motion, shape, spatial; palette warm neutral/);
  assert.equal(unusedByDial(recent, ['palette']).palette, undefined);
  assert.deepEqual(unusedByDial([]), {});
});

test('advice names a value that 3 or more of the films share, once each, and not an exempt dial', () => {
  const recent = sigs(['a', { band: 'professional', ease: 'land', palette: 'duotone' }], ['b', { band: 'professional', ease: 'land', palette: 'duotone' }], ['c', { band: 'professional', ease: 'settle', palette: 'duotone' }], ['d', { band: 'gravity', ease: 'land' }]);
  assert.deepEqual(repeatAdvice(recent), [
    'advice: band professional in 3 of the last 4 films; push away from it unless the brief needs it',
    'advice: ease land in 3 of the last 4 films; push away from it unless the brief needs it',
    'advice: palette duotone in 3 of the last 4 films; push away from it unless the brief needs it',
  ]);
  assert.equal(repeatAdvice(recent, ['palette']).some((l) => l.includes('palette')), false);
  assert.deepEqual(repeatAdvice(sigs(['a', { band: 'energy' }], ['b', { band: 'energy' }])), []);
});

test('namesBrandKit reads a hex colour, brand colours and a font; a plain style does not count', () => {
  assert.ok(namesBrandKit('accent #0a87ff'));
  assert.ok(namesBrandKit('use the brand colours'));
  assert.ok(namesBrandKit('Style: dark mode, a monospace font'));
  assert.ok(!namesBrandKit('a calm launch film, dark mode'));
});

test('varietyFor prints the table, the unused line and the advice; nothing without history', () => {
  const recent = sigs(['a', { band: 'professional', ease: 'land' }], ['b', { band: 'professional', ease: 'land' }], ['c', { band: 'professional', ease: 'land' }]);
  const v = varietyFor(recent, false);
  assert.equal(v.lines[0], 'signatures of the last 3 films:');
  assert.match(v.lines[1], /^film +band +ease +stagger +seam +palette +thread$/);
  assert.ok(v.lines.some((l) => l.startsWith('unused so far: band energy, gravity, cinematic')));
  assert.equal(v.lines.filter((l) => l.startsWith('advice: ')).length, 2);
  assert.match(v.lines.at(-1), /^these count past films, not this ask: choose the dials for this direction in <meta name="signature"> \(ranges: brief\.md, ## Signature\)$/);
  const branded = varietyFor(recent, true);
  assert.ok(branded.lines.some((l) => l.startsWith('brand kit: ')) && !/palette/.test(branded.lines.find((l) => l.startsWith('unused'))));
  assert.deepEqual(varietyFor([], false).lines, []);
});

test('the brief block lists the unused values under each range', () => {
  const section = signatureSection(undefined, { unused: { ease: ['settle', 'carry'] }, exempt: ['palette'] });
  assert.match(section, /^- ease .*\n {2}unused so far: settle, carry$/m);
  assert.match(section, /^- palette .*\n {2}the brief names a brand kit: follow it$/m);
  assert.equal(section.match(/^- (band|ease|stagger|seam|palette|thread) /gm).length, 6);
  assert.equal(signatureSection().includes('unused so far'), false);
});

test('vawe new on a root with logged films prints the table and writes the unused values in the brief', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-variety-'));
  fs.mkdirSync(path.join(root, 'prompts'));
  fs.copyFileSync(path.resolve(import.meta.dirname, '../../prompts/beat-sheet.md'), path.join(root, 'prompts/beat-sheet.md'));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.symlinkSync(path.resolve(import.meta.dirname, '../../assets/fonts'), path.join(root, 'assets/fonts'));
  fs.mkdirSync(path.join(root, 'out'));
  for (const film of ['one', 'two', 'three']) fs.writeFileSync(path.join(root, 'out', `${film}.runs.jsonl`), `${JSON.stringify({ at: `2026-10-0${film.length}T00:00:00Z`, cmd: 'dev', signature: { band: 'gravity', ease: 'settle' } })}\n`);
  const log = console.log;
  console.log = () => {};
  let made;
  try { made = newFilm('zz', { root, from: path.join(root, 'prompts/beat-sheet.md'), defaults: true }); } finally { console.log = log; }
  const lines = newFilmLines('zz', made);
  assert.ok(lines.includes('signatures of the last 3 films:'));
  assert.ok(lines.some((l) => l.startsWith('advice: band gravity in 3 of the last 3 films')));
  const brief = fs.readFileSync(path.join(root, 'films/zz/brief.md'), 'utf8');
  assert.match(brief, /^- band .*\n {2}unused so far: energy, professional, cinematic$/m);
  assert.equal(recentFromDisk(root, 'one').length, 2);
  fs.rmSync(root, { recursive: true, force: true });
});
