import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStream, countFirstDraft, acceptanceOf, claudeArgs, filmNameFor, loadPrompts, record, sideBySide, summarise,
} from '../../harness/dev/harness-bench.mjs';

const T0 = Date.parse('2026-11-17T10:00:00Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();

function stream(steps) {
  const lines = [];
  steps.forEach(([s, name, input, output = 'ok'], i) => {
    const id = `t${i}`;
    lines.push({ type: 'assistant', timestamp: at(s), message: { id: `m${i}`, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
    lines.push({ type: 'user', timestamp: at(s + 1), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: output }] } });
  });
  lines.push({ type: 'result', timestamp: at(200), duration_ms: 180000, num_turns: steps.length, total_cost_usd: 0.5, usage: { input_tokens: 10, output_tokens: 900, cache_read_input_tokens: 5000, cache_creation_input_tokens: 700 } });
  return lines.map((l) => JSON.stringify(l)).join('\n');
}

const verbRow = (s, verb, args, stage, extra = {}) => ({ cmd: 'verb', verb, args, stage, start: at(s), durationS: 2, exitCode: 0, ...extra });

const DEV_MD = `# x draft

## Draft check

advice: text is under 3 percent of frame height at 2.1 s
advice: the last second holds nothing
(advice only: the render continued)

## Acceptance

acceptance: 7 of 9 measured green (12 rows)
`;

const WRITE_PAGE = { file_path: '/repo/films/x/page.html', content: '<section data-world="a"></section>' };

test('a stream with a Write to films/x/page.html and a dev run is counted up to the first draft', async () => {
  const text = stream([
    [1, 'Bash', { command: 'bin/vawe new x --request "a sting"' }, 'vawe: new ok in 1.0s'],
    [10, 'Write', WRITE_PAGE],
    [20, 'Bash', { command: 'bin/vawe dev films/x/page.html' }, 'vawe: dev ok in 9.0s'],
    [60, 'Write', { file_path: '/repo/films/x/page.html', content: 'later fix' }],
  ]);
  const runs = [
    verbRow(1, 'new', 'x', 'new'),
    verbRow(20, 'dev', 'films/x/page.html', 'dev'),
    { cmd: 'dev', at: at(29), acceptance: { green: 7, measured: 9 }, rules_fired: [{ id: 'a' }, { id: 'b' }] },
  ];
  const c = await countFirstDraft({ rows: parseStream(text), runs, devMd: DEV_MD });
  assert.equal(c.draft, true);
  assert.equal(c.rawFilmWrites, 1, 'the Write after the first draft is not counted');
  assert.deepEqual(c.rawFilmWriteList, ['Write:x/page']);
  assert.equal(c.verbCalls, 2);
  assert.equal(c.rawMedia, 0);
  assert.equal(c.advice, 2, 'the end line is not a finding');
  assert.equal(c.rulesFired, 2);
  assert.deepEqual(c.acceptance, { green: 7, measured: 9 });
  assert.equal(c.output, 900);
  assert.equal(c.wallS, 180);
});

test('a run log with no board stage reports it skipped', async () => {
  const text = stream([
    [1, 'Bash', { command: 'bin/vawe new x --request "a sting"' }],
    [5, 'Bash', { command: 'bin/vawe refs list' }],
    [10, 'Write', { file_path: '/repo/films/x/DESIGN.md', content: 'design' }],
    [15, 'Write', WRITE_PAGE],
    [20, 'Bash', { command: 'bin/vawe frame films/x/page.html --world all' }],
    [25, 'Write', { file_path: '/repo/films/x/brief.md', content: '## Ideas\n- one' }],
    [30, 'Bash', { command: 'bin/vawe dev films/x/page.html' }],
  ]);
  const runs = [
    verbRow(1, 'new', 'x', 'new'), verbRow(5, 'refs', 'list', 'study'), verbRow(20, 'frame', 'films/x/page.html --world all', 'frames'),
    verbRow(30, 'dev', 'films/x/page.html', 'dev'),
  ];
  const c = await countFirstDraft({ rows: parseStream(text), runs, devMd: DEV_MD });
  assert.deepEqual(c.skippedStages, ['storyboard']);
  assert.equal(c.stagesSkipped, 1);
});

test('raw ffmpeg, a failed draft and an error line count as bypass and contract findings', async () => {
  const text = stream([
    [1, 'Bash', { command: 'ffmpeg -i a.mp4 b.mp4' }],
    [10, 'Bash', { command: 'bin/vawe dev films/x/page.html' }, 'vawe: dev FAILED (exit 1) in 3.0s'],
    [20, 'Bash', { command: 'bin/vawe dev films/x/page.html' }, 'vawe: dev ok in 9.0s'],
  ]);
  const runs = [
    verbRow(10, 'dev', 'films/x/page.html', 'dev', { exitCode: 1 }),
    { cmd: 'dev', at: at(13), failed: true, reason: 'error: setTimeout in page' },
    verbRow(20, 'dev', 'films/x/page.html', 'dev'),
    { cmd: 'dev', at: at(29), acceptance: null },
  ];
  const c = await countFirstDraft({ rows: parseStream(text), runs, devMd: 'error: no data-world\nadvice: x' });
  assert.equal(c.rawMedia, 1);
  assert.deepEqual(c.contractDetail, { failedDrafts: 1, refusals: 0, errorLines: 1 });
  assert.equal(c.contractFindings, 2);
});

test('a session that never drafts is marked and counted whole', async () => {
  const c = await countFirstDraft({ rows: parseStream(stream([[1, 'Write', WRITE_PAGE]])), runs: [], devMd: null });
  assert.equal(c.draft, false);
  assert.equal(c.rawFilmWrites, 1);
  assert.equal(c.acceptance, null);
});

test('acceptanceOf reads the summary line, else the table, else null', () => {
  assert.deepEqual(acceptanceOf(DEV_MD), { green: 7, measured: 9 });
  assert.deepEqual(acceptanceOf('| status | metric |\n| ok | a |\n| advice | b |\n| not measured | c |'), { green: 1, measured: 2 });
  assert.equal(acceptanceOf('nothing'), null);
});

test('the plugin variant needs a plugin folder or an MCP config; base takes neither', () => {
  const p = loadPrompts()[0];
  assert.throws(() => claudeArgs({ prompt: p, film: 'f', variant: 'plugin' }), /--plugin/);
  const args = claudeArgs({ prompt: p, film: 'f', variant: 'plugin', plugin: '/p', mcpConfig: '/m.json' });
  assert.ok(args.includes('--plugin-dir') && args.includes('--mcp-config'));
  assert.ok(!claudeArgs({ prompt: p, film: 'f', variant: 'base' }).includes('--plugin-dir'));
  assert.equal(args[args.indexOf('--output-format') + 1], 'stream-json');
});

test('three fixed prompts, and film names do not repeat', () => {
  const prompts = loadPrompts();
  assert.equal(prompts.length, 3);
  assert.notEqual(filmNameFor(prompts[0], 1), filmNameFor(prompts[0], 2));
});

test('record keys by variant then commit, and the table needs both variants', () => {
  const run = { draft: true, contractFindings: 2, stagesSkipped: 1, advice: 3, rulesFired: 1, acceptance: { green: 5, measured: 8 }, rawFilmWrites: 4, rawMedia: 0, verbCalls: 6, toolCalls: 20, output: 1000, wallS: 90 };
  const base = record({}, { variant: 'base', commit: 'abc', runs: [run, { ...run, contractFindings: 4 }], at: '2026-11-17T10:00:00Z' });
  assert.equal(base.base.abc.summary['contract findings'], 3);
  assert.match(sideBySide(base), /needs both variants/);
  const both = record(base, { variant: 'plugin', commit: 'def', runs: [{ ...run, contractFindings: 0, rawFilmWrites: 0 }], at: '2026-11-17T11:00:00Z' });
  assert.match(sideBySide(both), /contract findings\s+3\s+0/);
  assert.equal(summarise([])['contract findings'], null);
});
