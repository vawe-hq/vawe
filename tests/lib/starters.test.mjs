// The page `vawe new` starts from depends on the film type (harness/cli/route.mjs STARTERS): a sting, a brand launch and a story
// each have a starter file; every other type takes the general one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readNeed } from '../../harness/lib/worlds.mjs';
import { STARTERS, readRouting, starterWorlds, worldShares, wordlessIds, starterMin, starterType } from '../../harness/cli/route.mjs';
import { newFilm, starterPage, starterFace, typeBeats } from '../../harness/cli/new.mjs';
import { isStarterPage } from '../../harness/lib/frames-page.mjs';
import { HOLD_RULE } from '../../harness/lib/read-hold.mjs';
import { READ_MARGIN_S } from '../../harness/lib/worlds.mjs';
import { measuredSections } from '../../harness/lib/measured-brief.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TYPES = Object.keys(STARTERS);
// the lengths the type tests run at: the sting length, and for a launch and a story the shortest film, 12 s and the full starter
const LENGTHS = { sting: [5], 'brand launch': [starterMin('brand launch'), 12, 15], 'story or explainer': [starterMin('story or explainer'), 12, 20, 30] };
const worldIds = (page) => [...page.matchAll(/data-world="([a-z0-9-]+)"/g)].map((m) => m[1]);

function newIn(name, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-starters-'));
  for (const dir of ['prompts', 'guides', 'assets/fonts']) {
    fs.mkdirSync(path.dirname(path.join(root, dir)), { recursive: true });
    fs.symlinkSync(path.join(ROOT, dir), path.join(root, dir));
  }
  const log = console.log;
  console.log = () => {};
  try {
    const made = newFilm(name, { root, defaults: true, ...options });
    return { made, page: fs.readFileSync(path.join(root, made.page), 'utf8'), brief: fs.readFileSync(path.join(root, 'films', name, 'brief.md'), 'utf8') };
  } finally {
    console.log = log;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('every starter type is a ROUTING.md film type with a starter file', () => {
  const rows = Object.keys(readRouting(ROOT));
  for (const [type, { file }] of Object.entries(STARTERS)) {
    assert.ok(rows.includes(type), `${type} is not a row of guides/ROUTING.md`);
    assert.ok(fs.existsSync(path.join(ROOT, 'harness/cli/starters', `${file}.html`)), `${file}.html`);
  }
});

test('a request routes to the starter of its film type', () => {
  const sting = newIn('zz-a', { request: 'a 5 s logo reveal sting for Acme', title: 'Acme' });
  assert.match(sting.page, /the quiet beat/);
  assert.deepEqual(worldIds(sting.page), ['s1', 's2', 's3']);
  const launch = newIn('zz-b', { request: 'a 16 s launch film for https://acme.example', title: 'Ship faster' });
  assert.match(launch.page, /data-ui/);
  assert.deepEqual(worldIds(launch.page), ['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
  const story = newIn('zz-c', { request: 'a 30 s explainer: how a refund works', title: 'Refund fast' });
  assert.match(story.page, /class="flow"/);
  assert.deepEqual(worldIds(story.page), Array.from({ length: 12 }, (_, i) => `s${i + 1}`));
});

test('the template Length line is the one owner: the brief and the page say the same seconds', () => {
  for (const [name, request] of [['zz-i', 'a launch film for https://acme.example'], ['zz-j', 'an explainer: how a refund works']]) {
    const { page, brief } = newIn(name, { request, title: 'Refund fast' });
    const line = brief.match(/^- (?:Platform|Length)[^:]*: .*?(\d+(?:\.\d+)?) s/m);
    assert.ok(line, `${name}: no length line in the brief`);
    assert.match(page, new RegExp(`<meta name="duration" content="${line[1]}">`), name);
  }
});

test('a request that names a launch or a story keeps its type from the starter minimum, a bare length of 10 s or less stays a sting', () => {
  const ids = (name, request) => worldIds(newIn(name, { request }).page);
  assert.deepEqual(ids('zz-k', 'a 9 s launch film for acme'), ['s1', 's2', 's4', 's7']);
  assert.deepEqual(ids('zz-l', 'an 12 s explainer of refunds'), ['s1', 's2', 's6', 's8', 's12']);
  assert.deepEqual(ids('zz-m', 'a 6 s sting'), ['s1', 's2', 's3']);
  assert.deepEqual(ids('zz-n', 'a 9 s film'), ['s1', 's2', 's3']);
  assert.deepEqual(ids('zz-o', 'a 7 s launch film for acme'), ['s1', 's2', 's3']);
  assert.match(newIn('zz-p', { request: 'an 11 s launch film for https://acme.example' }).page, /data-ui/);
});

test('the starter minimum is the smallest film that holds four worlds, and a film under it takes the general starter', () => {
  const route = (type) => ({ known: true, type });
  for (const type of ['brand launch', 'story or explainer']) {
    const min = starterMin(type);
    assert.ok(starterWorlds(type, min).length >= 4, type);
    assert.equal(starterType(route(type), min), type);
    assert.equal(starterType(route(type), min - 0.1), undefined);
  }
});

test('the worlds kept grow with the length, in film order, from the first of the type order to the whole starter', () => {
  for (const type of ['brand launch', 'story or explainer']) {
    const { order } = STARTERS[type];
    let before = [];
    for (let length = starterMin(type); length <= 40; length += 1) {
      const ids = starterWorlds(type, length).map((w) => w.id);
      assert.deepEqual(ids, [...ids].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1))), `${type} ${length} s`);
      assert.ok(before.every((id) => ids.includes(id)), `${type} ${length} s drops a world`);
      assert.deepEqual(order.slice(0, ids.length).sort(), [...ids].sort(), `${type} ${length} s`);
      assert.ok(Math.abs(starterWorlds(type, length).reduce((sum, w) => sum + w.share, 0) - 1) < 1e-9);
      before = ids;
    }
    assert.equal(before.length, order.length, type);
  }
});

test('every kept world that shows text spans the read floor plus margin, from the starter minimum to the whole starter, and the count is the largest that does', () => {
  const floor = HOLD_RULE.floor + READ_MARGIN_S;
  for (const type of ['brand launch', 'story or explainer']) {
    const all = STARTERS[type].order.length;
    const wordless = wordlessIds(type);
    const shortest = (worlds, length) => Math.min(...worlds.filter((w) => !wordless.includes(w.id)).map((w) => w.share * length));
    for (let length = starterMin(type); ; length += 1) {
      const worlds = starterWorlds(type, length);
      assert.ok(shortest(worlds, length) >= floor - 1e-9, `${type} ${length} s: shortest text world ${shortest(worlds, length).toFixed(2)} s`);
      if (worlds.length === all) break;
      assert.ok(shortest(worldShares(type, worlds.length + 1), length) < floor, `${type} ${length} s keeps ${worlds.length} worlds but ${worlds.length + 1} fit`);
    }
  }
});

test('the starter minimum is the whole-second length at which the first four worlds each span the read floor plus margin', () => {
  const floor = HOLD_RULE.floor + READ_MARGIN_S;
  for (const type of ['brand launch', 'story or explainer']) {
    const wordless = wordlessIds(type);
    const shortest = (length) => Math.min(...worldShares(type, 4).filter((w) => !wordless.includes(w.id)).map((w) => w.share * length));
    const min = starterMin(type);
    assert.ok(shortest(min) >= floor - 1e-9 && shortest(min - 1) < floor, type);
  }
});

test('every kept world of a type starter is in the page, the brief Shots table and the beats, with no waiver', () => {
  for (const type of ['brand launch', 'story or explainer']) {
    for (const length of LENGTHS[type]) {
      const page = starterPage({ type, length, title: 'Acme', face: starterFace('zz-short') });
      const beats = typeBeats(type, length);
      assert.deepEqual(worldIds(page), beats.map((b) => b.id), `${type} ${length} s`);
      const { spec } = measuredSections({ name: 'zz-short', request: 'r', title: 'Acme', length, beats, face: starterFace('zz-short') }).sections;
      assert.deepEqual(spec.split('\n').filter((l) => /^\| s\d+ /.test(l)).map((l) => l.split('|')[1].trim()), worldIds(page));
      assert.doesNotMatch(page, /id="authoring"|\{\{/);
    }
  }
});

test('the brief length line and the page duration agree for a real film at the shortest length and at 12 s', () => {
  for (const [type, request] of [['brand launch', 'a LEN s launch film for https://acme.example'], ['story or explainer', 'an LEN s explainer: how a refund works']]) {
    for (const length of [starterMin(type), 12]) {
      const { page, brief } = newIn(`zz-q${length}`, { request: request.replace('LEN', length) });
      assert.match(brief.match(/^- (?:Platform|Length)[^:]*: .*$/m)[0], new RegExp(`${length} s`), `${type} ${length}`);
      assert.match(page, new RegExp(`<meta name="duration" content="${length}">`), `${type} ${length}`);
    }
  }
});

test('the template Length line states the shortest film of its starter', () => {
  for (const [file, type] of [['brand-launch-from-url', 'brand launch'], ['story-explainer', 'story or explainer']]) {
    const low = fs.readFileSync(path.join(ROOT, 'prompts', `${file}.md`), 'utf8').match(/^\*\*Length:\*\* (\d+)/m)[1];
    assert.equal(Number(low), starterMin(type), file);
  }
});

test('a starter page declares no waiver', () => {
  for (const type of TYPES) assert.doesNotMatch(starterPage({ type, length: LENGTHS[type].at(-1), title: 'Acme' }), /id="authoring"/, type);
});

test('another film type, and a film made with --from, keep the general starter', () => {
  const reel = newIn('zz-d', { request: 'a showreel of our work', length: 15 });
  assert.match(reel.page, /<ul class="facts">/);
  const unclear = newIn('zz-g', { request: 'something with our logo in it' });
  assert.match(unclear.page, /<ul class="facts">/);
  const invented = newIn('zz-h', { request: 'a launch film for an invented product' });
  assert.match(invented.page, /<ul class="facts">/);
  const from = newIn('zz-e', { from: path.join(ROOT, 'prompts/beat-sheet.md'), length: 6 });
  assert.match(from.page, /<ul class="facts">/);
});

test('the brief Shots table has one row per world of the type starter', () => {
  const { page, brief } = newIn('zz-f', { request: 'a 16 s launch film for https://acme.example', title: 'Ship faster' });
  const shots = brief.split('### Shots')[1].split('### Words')[0].split('\n').filter((l) => /^\| s\d /.test(l));
  assert.deepEqual(shots.map((l) => l.split('|')[1].trim()), worldIds(page));
  assert.match(shots[1], /^\| s2 \| 2\.3 \| 5\.3 \|/);
});

for (const type of TYPES) {
  const length = LENGTHS[type].at(-1);
  const make = (extra = {}) => starterPage({ type, length, title: 'Acme', face: starterFace('zz-type'), ...extra });

  test(`${type}: a valid page under the contract`, () => {
    const page = make();
    assert.doesNotMatch(page, /\{\{|undefined|NaN/);
    assert.match(page, new RegExp(`<meta name="duration" content="${length}">`));
    assert.match(page, /<meta name="message" /);
    assert.match(page, /<meta name="spectacle" content="\d+(\.\d+)?">/);
    assert.match(page, /<meta name="signature" content="band=; ease=; stagger=; seam=; palette=; thread=">/);
    assert.doesNotMatch(page, /cubic-bezier|system-ui|<audio|data-synth|https?:/);
    assert.match(page, /@font-face \{ font-family: "[^"]+"; src: url\("assets\/[A-Za-z]+\.woff2"\)/);
    assert.match(page, /EASE\./);
    const beats = typeBeats(type, length);
    assert.deepEqual(worldIds(page), beats.map((b) => b.id));
    for (const b of beats) assert.match(page, new RegExp(`--beat-${beats.indexOf(b) + 1}: ${b.start}s;`));
  });

  test(`${type}: sizes follow the frame, so no aspect crops it`, () => {
    const page = make({ aspect: '9:16' });
    assert.match(page, /<html data-aspect="9:16">/);
    assert.doesNotMatch(page, /font-size: \d+(\.\d+)?px/);
  });

  test(`${type}: the spectacle second lies inside the film, after the first world`, () => {
    const spectacle = Number(make().match(/<meta name="spectacle" content="([\d.]+)">/)[1]);
    assert.ok(spectacle > typeBeats(type, length)[1].start && spectacle < length, `${spectacle} s`);
  });

  test(`${type}: still reads as the unedited starter`, () => {
    assert.equal(isStarterPage(make()), true);
  });
}

test('a sting of any length from 2 s keeps its beats in order inside the film and leaves the lockup its read time', () => {
  const need = readNeed(['Acme', 'why it matters']);
  for (const length of [2, 3, 5, 12]) {
    const page = starterPage({ type: 'sting', length, title: 'Acme', face: starterFace('zz-short') });
    const starts = [...page.matchAll(/--beat-\d+: ([\d.]+)s;/g)].map((m) => Number(m[1]));
    const spectacle = Number(page.match(/<meta name="spectacle" content="([\d.]+)">/)[1]);
    assert.equal(starts.length, 3, `${length} s`);
    assert.equal(starts[0], 0);
    assert.ok(starts.every((s, i) => i === 0 || s > starts[i - 1]) && starts[2] < length, `${length} s: ${starts}`);
    assert.ok(starts[1] >= 0.5 && spectacle > starts[1] && spectacle < starts[2], `${length} s: spectacle ${spectacle}`);
    assert.ok(length - starts[1] >= Math.min(need, length - 0.5) - 1e-9, `${length} s: the lockup holds ${length - starts[1]} s`);
    assert.doesNotMatch(page, /\{\{|undefined|NaN/);
  }
});
