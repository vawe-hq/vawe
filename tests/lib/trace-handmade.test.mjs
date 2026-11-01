import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { rawTools } from '../../harness/lib/trace/calls.mjs';
import { handmadeShapes, normaliseShape, rankShapes, coveringVerb } from '../../harness/lib/trace/handmade.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const bash = (cmd, raw) => ({ name: 'Bash', cmd, raw });
const write = (file) => ({ name: 'Write', cmd: file, raw: [] });

test('normaliseShape merges commands that differ only in paths and numbers', () => {
  const a = normaliseShape('ffmpeg -ss 1.2 -i a.mp4 -frames:v 1 x.png');
  const b = normaliseShape('ffmpeg -ss 3 -i b.mp4 -frames:v 1 y.png');
  assert.equal(a, b);
  assert.match(a, /^ffmpeg -ss N -i P -frames:v N P$/);
});

test('normaliseShape keeps different tools and flags apart', () => {
  assert.notEqual(normaliseShape('ffmpeg -ss 1 -i a.mp4 -frames:v 1 x.png'), normaliseShape('ffmpeg -i a.mp4 -vf fps=2 out/%03d.png'));
  assert.notEqual(normaliseShape('ffprobe -i a.mp4'), normaliseShape('ffmpeg -i a.mp4'));
});

test('handmadeShapes counts raw tools and script writes, not film or harness files', () => {
  const events = handmadeShapes([
    bash('ffmpeg -ss 1 -i a.mp4 -frames:v 1 x.png', ['ffmpeg']),
    bash('python3 -c "from PIL import Image"', ['pil']),
    bash('node harness/dev/e2e.mjs', []),
    write('/w/.shot-tmp.mjs'),
    write('/w/films/demo/helper.mjs'),
    write('/w/harness/lib/x.mjs'),
    write('/w/films/demo/page.html'),
  ], { session: 's1', films: ['demo'] });
  assert.deepEqual(events.map((e) => e.kind), ['ffmpeg', 'pil', 'write']);
  assert.equal(events[2].shape, 'write .shot-tmp.mjs');
  assert.deepEqual(events[0].films, ['demo']);
});

test('rankShapes counts per shape with films and sessions, most frequent first', () => {
  const ev = (shape, film, session) => ({ shape, kind: 'ffmpeg', sample: shape, films: [film], session });
  const ranked = rankShapes([ev('a', 'f1', 's1'), ev('b', 'f1', 's1'), ev('a', 'f2', 's2')]);
  assert.deepEqual(ranked.map((r) => [r.shape, r.count]), [['a', 2], ['b', 1]]);
  assert.deepEqual(ranked[0].films, ['f1', 'f2']);
  assert.deepEqual(ranked[0].sessions, ['s1', 's2']);
});

test('coveringVerb names an existing verb, or null', () => {
  assert.equal(coveringVerb('ffmpeg -ss 1.2 -i a.mp4 -frames:v 1 x.png'), 'frame');
  assert.equal(coveringVerb('ffmpeg -i a.mp4 -vf tile=4x4 s.png'), 'frame');
  assert.equal(coveringVerb('ffmpeg -i a.mp4 -c:v libx264 b.mp4'), null);
});

test('rawTools matches a tool at command position, not inside a grep pattern or a quoted string', () => {
  assert.deepEqual(rawTools('ps aux | grep "render-page" | cut -c1-80', false), ['hint:wait', 'psPoll']);
  assert.deepEqual(rawTools('pgrep -fl caffeinate', false), []);
  assert.deepEqual(rawTools('echo "sleep 5; curl x"', false), []);
  assert.deepEqual(rawTools('grep -n "python3 PIL" notes.md', false), []);
  assert.deepEqual(rawTools('until [ -s f ]; do sleep 2; done', false), ['hint:wait', 'sleep']);
  assert.deepEqual(rawTools('python3 -c "from PIL import Image"', false), ['pil']);
  assert.deepEqual(rawTools("node -e 'x'", false), ['nodeEval']);
});

test('coveringVerb maps polling loops to wait', () => {
  for (const cmd of ['sleep 5', 'until grep -q done log; do sleep 2; done', 'ps aux | grep render | wc -l', 'pgrep -f render']) assert.equal(coveringVerb(cmd), 'wait', cmd);
});

test('--handmade: an empty result says so, --json prints JSON, --compare is a usage error', () => {
  const run = (...args) => spawnSync('node', ['harness/dev/trace-review.mjs', ...args], { cwd: root, encoding: 'utf8' });
  const file = 'tests/fixtures/trace/proj/sess-1.jsonl';
  assert.match(run('--handmade', file).stdout, /no hand-made commands found/);
  assert.ok(Array.isArray(JSON.parse(run('--handmade', '--json', file).stdout)));
  const cmp = run('--handmade', '--compare', '2026-01-01', file);
  assert.equal(cmp.status, 2);
  assert.match(cmp.stderr, /--handmade does not take --compare/);
});
