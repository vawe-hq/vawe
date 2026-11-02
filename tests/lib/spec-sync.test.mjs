import test from 'node:test';
import assert from 'node:assert/strict';
import { syncSpec } from '../../harness/lib/spec-sync.mjs';
import { parseBriefTables } from '../../harness/lib/brief-tables.mjs';

const brief = `# film: brief

### Words
| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |
|---|---|---|---|---|---|---|---|---|
| Ship it | S1 | 1.0 s | 1.5 s | 8 | 10 | 40 | 700 | ink |
| Done | S2 | 3 | 3.5* | 7 | 10 | 40 | 700 | ink |
| Ghost | S2 | 4 | 4.5 | 7 | 10 | 40 | 700 | ink |

### Objects
| id | selector | shot | in s | settle s | out s |
|---|---|---|---|---|---|
| mark | .mark | S1 | 0.3 | 0.9 | 2 |

## Acceptance
| metric | target |
`;

const measured = {
  words: [{ text: 'Ship it', appear: 1.25, settle: 1.5 }, { text: 'Done', appear: 3, settle: 3.5 }],
  objects: [{ id: 'mark', in: 0.3, settle: 0.77, out: null }],
};

test('spec-sync writes the measured times, keeps text, shot and targets, and marks each changed cell', () => {
  const { text, changes, missing } = syncSpec(brief, measured);
  const t = parseBriefTables(text);
  assert.deepEqual(t.words.map((w) => [w.text, w.shot, w.appear, w.settle, w.cap, w.x, w.y]), [['Ship it', 'S1', 1.25, 1.5, 8, 10, 40], ['Done', 'S2', 3, 3.5, 7, 10, 40], ['Ghost', 'S2', 4, 4.5, 7, 10, 40]]);
  assert.deepEqual(t.objects.map((o) => [o.in, o.settle, o.out]), [[0.3, 0.77, 2]]);
  assert.match(text, /\| Ship it \| S1 \| 1\.25 s\* \| 1\.5 s \| 8 \|/);
  assert.match(text, /\| Done \| S2 \| 3 \| 3\.5 \| 7 \|/);
  assert.deepEqual(changes, ['Words "Ship it" appear: 1.0 s -> 1.25 s', 'Objects "mark" settle: 0.9 -> 0.77']);
  assert.deepEqual(missing, ['Words "Ghost"']);
});

test('spec-sync is stable: a second run with the same measure changes nothing and clears old marks', () => {
  const once = syncSpec(brief, measured).text;
  const twice = syncSpec(once, measured);
  assert.deepEqual(twice.changes, []);
  assert.doesNotMatch(twice.text, /\*/);
});

test('spec-sync writes the Shots start, end and ground from the measured worlds, adding the ground column at the end', () => {
  const shots = `### Shots
| id | start s | end s | the viewer notices | move in | move out | camera |
|---|---|---|---|---|---|---|
| s1 | 0 | 2 | a line | cut | fade | still |
| s2 (guess: change me) | 2 | 4 | x | cut | fade | still |

### Words
`;
  const worlds = [{ id: 'S1', start: 0, end: 2.4, ground: '#16151a' }, { id: 's2', start: 2.4, end: 4, ground: '#fff' }];
  const { text, changes, missing } = syncSpec(shots, { words: [], objects: [], worlds });
  const t = parseBriefTables(text);
  assert.deepEqual(t.shots.map((s) => [s.id, s.start, s.end, s.ground]), [['s1', 0, 2.4, '#16151a'], ['s2 (guess: change me)', 2, 4, '']]);
  assert.match(text, /\| camera \| ground \|\n\| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \|/);
  assert.deepEqual(changes, ['Shots "s1" end: 2 -> 2.4']);
  assert.deepEqual(missing, ['Shots "s2 (guess: change me)"']);
});

test('spec-sync finds columns by header name: an author column in the ground slot or before start is kept', () => {
  const shots = `### Shots
| id | the viewer notices | start s | end s | move in | move out | camera | sound |
|---|---|---|---|---|---|---|---|
| s1 | a line | 0 | 2 | cut | fade | still | thud at 0.2 |
| s2 | the star | 2 | 4 | cut | fade | still | sweep |
`;
  const worlds = [{ id: 's1', start: 0, end: 2.4, ground: '#111' }, { id: 's2', start: 2.4, end: 4, ground: '#fff' }];
  const { text } = syncSpec(shots, { words: [], objects: [], worlds });
  const t = text.split('\n');
  assert.equal(t[3], '| s1 | a line | 0 | 2.4* | cut | fade | still | thud at 0.2 | #111 |');
  assert.equal(t[4], '| s2 | the star | 2.4* | 4 | cut | fade | still | sweep | #fff |');
  assert.match(t[1], /\| sound \| ground \|$/);
});

test('spec-sync gives each Words row with the same text its own measure', () => {
  const twice = `### Words
| text | shot | appear s | settle s |
|---|---|---|---|
| Go | S1 | 1 | 1.5 |
| Go | S2 | 3 | 3.5 |
`;
  const { text } = syncSpec(twice, { words: [{ text: 'Go', appear: 1, settle: 1.5 }, { text: 'Go', appear: 3.2, settle: 3.5 }], objects: [] });
  assert.deepEqual(parseBriefTables(text).words.map((w) => [w.appear, w.settle]), [[1, 1.5], [3.2, 3.5]]);
});
