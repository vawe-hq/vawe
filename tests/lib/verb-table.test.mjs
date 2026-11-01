import test from 'node:test';
import assert from 'node:assert/strict';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { TIERS, topHelp, verbHelp, UsageError } from '../../harness/cli/parse.mjs';
import { ALIASES } from '../../harness/cli/aliases.mjs';
import { GATES } from '../../harness/lib/check-gate.mjs';

const verb = (name) => VERBS.find((v) => v.name === name);
const argsOf = (name, values, positional) => verb(name).build(values, positional)[0].args;

const STOP = new Set(['use', 'when', 'you', 'the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'is', 'it', 'its', 'one', 'with', 'then', 'at', 'as', 'by', 'each', 'every']);
const tokens = (text) => new Set(String(text).toLowerCase().match(/[a-z][a-z0-9-]+/g).filter((t) => !STOP.has(t)));
const overlap = (a, b) => [...a].filter((t) => b.has(t)).length / Math.min(a.size, b.size);

test('every verb has a tier, a unique name and a one-line summary', () => {
  const tiers = TIERS.map(([tier]) => tier);
  assert.equal(new Set(VERBS.map((v) => v.name)).size, VERBS.length);
  for (const v of VERBS) {
    assert.ok(tiers.includes(v.tier), `${v.name} has no tier (core, more or maintainer)`);
    assert.equal(typeof v.summary, 'string', `${v.name} summary is not a string`);
    assert.ok(!v.summary.includes('\n'), `${v.name} summary spans lines`);
  }
});

test('the verb set stays small', () => {
  assert.ok(VERBS.length <= 24, `${VERBS.length} verbs: merge into a flag of the owner verb before you add one`);
  assert.ok(VERBS.filter((v) => v.tier === 'core').length <= 15);
});

test('no two core verbs share their purpose line', () => {
  const core = VERBS.filter((v) => v.tier === 'core');
  for (const a of core) {
    for (const b of core) {
      if (a.name < b.name) assert.ok(overlap(tokens(a.summary), tokens(b.summary)) < 0.5, `${a.name} and ${b.name} read alike: ${overlap(tokens(a.summary), tokens(b.summary)).toFixed(2)}`);
    }
  }
});

test('every core verb but dev and ship opens with when to use it', () => {
  for (const v of VERBS.filter((x) => x.tier === 'core' && !/^(dev|ship)$/.test(x.name))) assert.match(v.summary, /^use when /, v.name);
});

test('the verbs that became flags are gone, with no alias', () => {
  const gone = ['look', 'looks', 'onion', 'velocity', 'spec', 'spec-sync', 'compare', 'sounds', 'sfx', 'audio', 'sound-lab', 'timeline', 'review', 'coverage', 'links', 'match', 'track', 'ref-cutlist', 'ref-calibrate'];
  for (const name of gone) assert.equal(verb(name), undefined, name);
  for (const name of gone) assert.equal(ALIASES[name], undefined, name);
});

test('the picture verbs became modes of frame; their old names live in ALIASES, not in the verb table', () => {
  for (const name of ['still', 'frames', 'sheet', 'strip', 'zoom', 'storyboard']) {
    assert.equal(verb(name), undefined, name);
    assert.equal(typeof ALIASES[name], 'function', name);
  }
  assert.ok(verb('frame'));
});

test('review, coverage and links run as gates of check', () => {
  for (const name of ['review', 'coverage', 'links']) assert.ok(GATES[name], name);
});

test('--help lists the core verbs, and --help --all lists every verb under its tier', () => {
  const short = topHelp(VERBS);
  const all = topHelp(VERBS, { all: true });
  for (const v of VERBS) {
    assert.equal(new RegExp(`^  ${v.name}\\s`, 'm').test(short), v.tier === 'core', `${v.name} in the short help`);
    assert.match(all, new RegExp(`^  ${v.name}\\s`, 'm'), `${v.name} in the full help`);
  }
  assert.match(short, /\d+ more verbs: vawe --help --all/);
  assert.ok(all.indexOf('the loop:') < all.indexOf('more:') && all.indexOf('more:') < all.indexOf('maintainers'));
});

test('verb --help starts with the summary', () => {
  for (const v of VERBS) assert.equal(verbHelp(v).split('\n')[0], v.summary);
});

test('sound --sfx and --lab take the place of sfx and sound-lab', () => {
  assert.deepEqual(argsOf('sound', { sfx: true, film: 'f.html', trim: '0.1,0.5', peak: -6 }, ['click.wav']), ['click.wav', '--film', 'f.html', '--trim', '0.1,0.5', '--peak', '-6']);
  assert.throws(() => argsOf('sound', { sfx: true }, ['click.wav']), /missing --film/);
  assert.throws(() => argsOf('sound', { trim: '0,1' }, ['click.wav']), /--trim needs --sfx/);
  assert.equal(verb('sound').build({ lab: true }, [])[0].script, 'harness/dev/sound-lab.mjs');
  assert.equal(verb('sound').build({}, [])[0].script, 'harness/dev/list-assets.mjs');
});

test('see --spec and --sync-brief take the place of spec and spec-sync', () => {
  const [spec] = verb('see').build({ spec: true, fast: true, 'no-ocr': true }, ['ref.mp4']);
  assert.equal(spec.script, 'harness/media/ref-spec.mjs');
  assert.deepEqual(spec.args, ['ref.mp4', '--fast']);
  assert.throws(() => verb('see').build({ spec: true }, ['p.html']), /measures a reference mp4/);
  assert.throws(() => verb('see').build({ fast: true }, ['ref.mp4']), /--fast needs --spec/);
  const [sync] = verb('see').build({ 'sync-brief': true }, ['p.html']);
  assert.deepEqual([sync.script, sync.args], ['harness/media/spec-sync.mjs', ['p.html']]);
  assert.throws(() => verb('see').build({ 'sync-brief': true }, ['a.mp4']), /reads a page/);
});

test('critique: a motion mismatch against the reference is advice, so the critic still runs', () => {
  const steps = verb('critique').build({ ref: 'r.mp4', fresh: true }, ['films/f/page.html']);
  const refStep = steps.find((s) => s.args.includes('--dom'));
  assert.equal(refStep.advice, true);
  assert.ok(steps.indexOf(refStep) < steps.findIndex((s) => s.script.endsWith('critic-fresh.mjs')));
  assert.equal(steps.filter((s) => s.advice).length, 1);
});
