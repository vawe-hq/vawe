import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupMissed, lookupOf, nextPlacement } from '../../harness/lib/trace/calls.mjs';
import { foldRows } from '../../harness/lib/trace/fold.mjs';
import { analyze } from '../../harness/lib/trace/analyze.mjs';
import { aggregate } from '../../harness/lib/trace/aggregate.mjs';

const T0 = Date.parse('2026-11-01T10:00:00Z');

/** A transcript of [name, input, result text] steps, two seconds apart. */
function transcript(steps) {
  const rows = [];
  steps.forEach(([name, input, text], i) => {
    const id = `t${i}`;
    rows.push({ type: 'assistant', timestamp: new Date(T0 + i * 2000).toISOString(), message: { content: [{ type: 'tool_use', id, name, input }] } });
    rows.push({ type: 'user', timestamp: new Date(T0 + i * 2000 + 1000).toISOString(), message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] } });
  });
  return (async function* () { yield* rows; }());
}

const agentOf = async (steps) => analyze(await foldRows(transcript(steps)), '/p/s/subagents/agent-x.jsonl');

test('lookupOf names reads and searches by the first command of a chain, past env and rtk', () => {
  assert.deepEqual(lookupOf('Read', { file_path: '/r/core/motion/presets.js' }), { kind: 'read', target: '/r/core/motion/presets.js' });
  assert.deepEqual(lookupOf('Grep', { pattern: 'springTo' }), { kind: 'search', target: 'springTo' });
  assert.deepEqual(lookupOf('Bash', { command: 'sed -n 1,40p core/surfaces/lens.js' }), { kind: 'read', target: 'core/surfaces/lens.js' });
  assert.deepEqual(lookupOf('Bash', { command: 'VAWE_AGENT=a rtk cat guides/IDEATE.md && ls out' }), { kind: 'read', target: 'guides/IDEATE.md' });
  assert.equal(lookupOf('Bash', { command: 'grep -rn "x" harness | head' }).kind, 'search');
  assert.equal(lookupOf('Bash', { command: 'ls films/' }).kind, 'search');
  assert.equal(lookupOf('Bash', { command: 'bin/vawe dev films/f/page.html; cat out/x.log' }), null);
  assert.equal(lookupOf('Write', { file_path: 'films/f/page.html' }), null);
});

test('lookupMissed: a missing path or an empty search misses; an image read with no text does not', () => {
  const read = { kind: 'read' };
  const search = { kind: 'search' };
  assert.equal(lookupMissed(read, 'File does not exist. Note: your current working directory is /r.'), true);
  assert.equal(lookupMissed(read, 'cat: x.md: No such file or directory'), true);
  assert.equal(lookupMissed(read, ''), false);
  assert.equal(lookupMissed(read, '1\timport x'), false);
  assert.equal(lookupMissed(search, ''), true);
  assert.equal(lookupMissed(search, 'No files found'), true);
  assert.equal(lookupMissed(search, 'zsh:1: no matches found: out/*.png'), true);
  assert.equal(lookupMissed(search, "0 matches for 'springTo'"), true);
  assert.equal(lookupMissed(search, 'core/motion/springs.js:12:export function springTo'), false);
});

test('nextPlacement counts the non-empty lines after each next line', () => {
  assert.deepEqual(nextPlacement('a\nnext: bin/vawe dev p\n\nvawe: frame ok in 1.0s'), [1]);
  assert.deepEqual(nextPlacement('next: bin/vawe dev p\na\nb\nc'), [3]);
  assert.deepEqual(nextPlacement('  next: indented is not a next line'), []);
});

test('navigation: reads before the page, text reread, task-output polls and misses', async () => {
  const a = await agentOf([
    ['Read', { file_path: '/r/AGENTS.md' }, 'x'],
    ['Read', { file_path: '/r/core/motion/presets.js' }, 'x'],
    ['Bash', { command: 'grep -rn springTo core' }, ''],
    ['Read', { file_path: '/r/harness/lib/worlds.mjs' }, 'File does not exist.'],
    ['Write', { file_path: '/r/films/f/page.html', content: '<section data-world="a"></section>' }, 'ok'],
    ['Read', { file_path: '/r/core/motion/presets.js' }, 'x'],
    ['Read', { file_path: '/r/out/f-frames.png' }, ''],
    ['Read', { file_path: '/r/out/f-frames.png' }, ''],
    ['Read', { file_path: '/tmp/s/tasks/b1.output' }, 'rendering'],
    ['Read', { file_path: '/tmp/s/tasks/b1.output' }, 'done'],
  ]);
  const n = a.navigation;
  assert.equal(n.readsBeforePage, 3);
  assert.equal(n.searchesBeforePage, 1);
  assert.equal(n.reads, 8);
  assert.equal(n.searches, 1);
  assert.equal(n.rereads, 1);
  assert.deepEqual(n.topRereads, [{ target: '/r/core/motion/presets.js', times: 2 }]);
  assert.equal(n.pollReads, 2);
  assert.equal(n.missedReads, 1);
  assert.equal(n.missedSearches, 1);
  assert.deepEqual(n.missed, ['search grep -rn springTo core', 'read /r/harness/lib/worlds.mjs']);
});

test('aggregate counts the same verb again apart, and splits ignored next lines into a big result, a buried line and neither', async () => {
  const big = `${'x'.repeat(9000)}\nnext: bin/vawe dev films/f/page.html\nvawe: frame ok in 1.0s`;
  const a = await agentOf([
    ['Bash', { command: 'bin/vawe frame films/f/page.html --world all' }, big],
    ['Bash', { command: 'bin/vawe refs list' }, 'next: bin/vawe critique films/f/page.html\none\ntwo\nthree'],
    ['Bash', { command: 'bin/vawe frame films/f/page.html --board' }, 'next: bin/vawe critique films/f/page.html\nvawe: frame ok in 1.0s'],
    ['Bash', { command: 'bin/vawe refs list' }, 'next: bin/vawe dev films/f/page.html\nvawe: refs ok in 1.0s'],
    ['Bash', { command: 'bin/vawe dev films/f/page.html' }, 'next: bin/vawe critique films/f/page.html --fresh\nvawe: dev ok in 9.0s'],
    ['Bash', { command: 'bin/vawe dev films/f/page.html' }, 'vawe: dev ok in 9.0s'],
  ]);
  const r = aggregate([a]).routing;
  assert.equal(r.nextLines, 5);
  assert.equal(r.nextFollowed, 1);
  assert.equal(r.nextRepeated, 1);
  assert.equal(r.nextIgnored, 3);
  assert.equal(r.nextIgnoredBig, 1);
  assert.equal(r.nextIgnoredBuried, 1);
  assert.equal(r.nextIgnoredPlain, 1);
});
