import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBriefTables, numberOf } from '../../harness/lib/brief-tables.mjs';

const brief = `# Brief

## Spec
### Shots
| id | start s | end s | the viewer notices | move in | move out | camera |
|---|---|---|---|---|---|---|
| S1 | 0 | 2.4 | the mark lands | wipe | cut | push 4% |
|S2|2.4|5|  a line reads | cut | fade | still |

### Words
| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ship it | S1 | 0.6 | 1.0 | 8 | 10% | 42.5 | 700 | #fff |

### Objects
| id | selector | shot | in s | settle s | out s |
|---|---|---|---|---|---|
| mark | \`.mark\` | S1 | 0.2 | 0.9 | 2.3 |

## Acceptance
| metric | target |
|---|---|
| jerky steps | under 5 |
| loudness | -24 to -16 LUFS (guess: change me) |

## Beats
| not | a spec table |
`;

test('the four tables parse with numbers, tolerant of spacing, pipes and code spans', () => {
  const t = parseBriefTables(brief);
  assert.equal(t.shots.length, 2);
  assert.deepEqual(t.shots[1], { id: 'S2', start: 2.4, end: 5, notices: 'a line reads', moveIn: 'cut', moveOut: 'fade', camera: 'still', ground: '' });
  assert.deepEqual(t.words[0], { text: 'Ship it', shot: 'S1', appear: 0.6, settle: 1, cap: 8, x: 10, y: 42.5, weight: '700', colour: '#fff' });
  assert.deepEqual(t.objects[0], { id: 'mark', selector: '.mark', shot: 'S1', in: 0.2, settle: 0.9, out: 2.3 });
  assert.deepEqual(t.acceptance.map((r) => r.metric), ['jerky steps', 'loudness']);
  assert.equal(t.acceptance[1].target, '-24 to -16 LUFS (guess: change me)');
});

test('a brief with no tables, or no brief, parses to empty arrays', () => {
  const empty = { shots: [], words: [], objects: [], acceptance: [] };
  assert.deepEqual(parseBriefTables('# Brief\n\n## Beats\n| a | b |\n'), empty);
  assert.deepEqual(parseBriefTables(null), empty);
});

test('numberOf reads seconds and percents and rejects prose', () => {
  assert.equal(numberOf('1.5 s'), 1.5);
  assert.equal(numberOf('12%'), 12);
  assert.equal(numberOf('-'), null);
  assert.equal(numberOf(''), null);
});

test('a cell spec-sync marked with * still reads as its number', () => {
  assert.equal(numberOf('1.2 s*'), 1.2);
  assert.equal(numberOf('14%'), 14);
});

test('columnIndex: a header that misses a required column is read by position, not as empty cells', async () => {
  const { columnIndex } = await import('../../harness/lib/brief-tables.mjs');
  assert.equal(columnIndex('Words', ['text', 'shot', 'appear s', 'settle s']).cap, 4);
  assert.equal(columnIndex('Words', ['text', 'shot', 'appear s', 'settle s', 'cap %', 'x %', 'y %', 'weight', 'colour']).cap, 4);
  assert.equal(columnIndex('Shots', ['id', 'start s', 'end s', 'the viewer notices', 'move in', 'move out', 'camera']).ground, -1);
});
