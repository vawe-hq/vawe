import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { appendRun, readRuns, readAllRuns, agentId, namedAgent } from '../../harness/lib/runlog.mjs';
import { newEvent, devEvent, judgeEvent, shipEvent } from '../../harness/lib/run-events.mjs';
import { selfRecordCheck } from '../../harness/lib/judge-self-record.mjs';
import { filmLines, allRows, modelRows, allLines, normalize, phaseMedians } from '../../harness/lib/runs-report.mjs';
import { jobLogPath, shipVerdict } from '../../harness/lib/ship-status.mjs';

const ROWS = [
  { metric: 'a', status: 'ok' },
  { metric: 'b', status: 'advice' },
  { metric: 'c', status: 'not measured' },
];

function inTempDir(env, fn) {
  const cwd = process.cwd();
  const saved = {};
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === null) delete process.env[k]; else process.env[k] = env[k]; }
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-runlog-')));
  try { return fn(); } finally {
    process.chdir(cwd);
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

const PHASES = { start: 0.5, slot: 0, chrome: 0.3, load: 1.2, prepass: 0, capture: 18.04, verify: 0.4, encode: 0.3, audio: 0.6 };
const SHAPE = { chrome: 'reused', frames: 150, reused: 10, fps: 30, width: 960, height: 540, workers: 2, slices: 3, durS: 5 };

test('event shapes: new, dev, judge, ship carry only their own fields', () => {
  assert.deepEqual(newEvent({ template: 'prompts/a.md', length: 5, answered: new Set(['show']), guessed: ['words'] }),
    { cmd: 'new', template: 'prompts/a.md', length: 5, answered: ['show'], guessed: ['words'], signature: { offered: {}, chosen: {} } });
  assert.deepEqual(devEvent({ file: '/o/f-draft.mp4', tier: 'draft', wallS: 31.44, phases: PHASES, shape: SHAPE, checks: [['contrast', 3.14], ['spec', 2], ['sheet', 1]], cache: { hit: 1, miss: 2 }, rows: ROWS }),
    { cmd: 'dev', file: '/o/f-draft.mp4', tier: 'draft', wallS: 31.4, startS: 0.5, slotS: 0, chromeS: 0.3, loadS: 1.2, prepassS: 0, captureS: 18, verifyS: 0.4, encodeS: 0.3, audioS: 0.6, checksTotalS: 5.1, sheetS: 1, otherS: 4,
      chrome: 'reused', frames: 150, reusedFrames: 10, fps: 30, width: 960, height: 540, workers: 2, slices: 3, durS: 5,
      checksS: { contrast: 3.1, spec: 2, sheet: 1 }, cache: { hit: 1, miss: 2 }, acceptance: { green: 1, measured: 2, red: ['b'] }, signature: {}, measured: {}, rules_fired: [], worlds: null });
  const worlds = [{ id: 'a', start: 0, end: 2, ground: '#112233' }];
  assert.deepEqual(devEvent({ tier: 'draft', wallS: 1, phases: PHASES, shape: SHAPE, checks: [], cache: { hit: 0, miss: 0 }, rows: null, worlds }).worlds, worlds);
  assert.equal(devEvent({ tier: 'fast', wallS: 1, phases: PHASES, shape: SHAPE, checks: [], cache: { hit: 0, miss: 0 }, rows: null }).acceptance, null);
  assert.deepEqual(judgeEvent({ stage: 'draft', verdict: 'FIX', scores: { hook: 9, motion: 6 }, anchor: [{ yes: true }, { yes: false }], ledger: { fixed: 1, partly: 0, still: 2, unmarked: 0, new: 1 }, seconds: 30.2 }),
    { cmd: 'judge', stage: 'draft', verdict: 'FIX', scores: { hook: 9, motion: 6 }, total: 15, anchorYes: 1, anchorTotal: 2, bar: null, ledger: { fixed: 1, partly: 0, still: 2, unmarked: 0, new: 1 }, seconds: 30.2, notes: null, waivers: null, sameness: null, template: null });
  assert.deepEqual(judgeEvent({ stage: 'final', verdict: 'FIX', bar: [{ ref: 'A', dial: 'text', winner: 'A' }] }).bar, [{ ref: 'A', dial: 'text', winner: 'A' }]);
  assert.deepEqual(shipEvent({ verdict: 'PASS', renderS: 120.04, acceptance: { green: 5, measured: 5, red: [] } }),
    { cmd: 'ship', verdict: 'PASS', renderS: 120, acceptance: { green: 5, measured: 5, red: [] } });
  assert.equal(shipEvent({ renderS: 1 }).verdict, null);
});

test('appendRun stamps the common fields; VAWE_AGENT and VAWE_MODEL are read from the environment', () => {
  inTempDir({ VAWE_AGENT: 'judge-x', VAWE_MODEL: 'sonnet', CLAUDE_CODE_SESSION_ID: 'abcdef123456' }, () => {
    const line = appendRun('films/demo/page.html', shipEvent({ verdict: null, renderS: 2 }));
    assert.equal(line.film, 'demo');
    assert.equal(line.agent, 'judge-x');
    assert.equal(line.model, 'sonnet');
    assert.equal(line.session, 'abcdef123456');
    assert.equal(typeof line.trackedDirty, 'boolean');
    assert.ok(!('dirty' in line));
    assert.ok(Date.parse(line.at) > 0);
    assert.equal(readRuns('demo').length, 1);
    assert.ok(!('content' in line) && !('craftLive' in line) && !('sceneLive' in line) && !('knowledge' in line));
  });
});

test('without VAWE_AGENT the agent is the session plus one tag per process; the model is null', () => {
  inTempDir({ VAWE_AGENT: null, VAWE_MODEL: null, CLAUDE_CODE_SUBAGENT_MODEL: null, CLAUDE_CODE_SESSION_ID: 'abcdef123456' }, () => {
    assert.match(agentId(), /^abcdef12#[0-9a-f]{4}$/);
    assert.equal(agentId(), agentId());
    assert.equal(namedAgent(agentId()), null);
    assert.equal(appendRun('demo', { cmd: 'dev' }).model, null);
  });
});

test('without VAWE_MODEL the model is the Claude Code subagent model, else null', () => {
  inTempDir({ VAWE_AGENT: null, VAWE_MODEL: null, CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' }, () => {
    assert.equal(appendRun('demo', { cmd: 'dev' }).model, 'haiku');
  });
  inTempDir({ VAWE_AGENT: null, VAWE_MODEL: 'opus', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' }, () => {
    assert.equal(appendRun('demo', { cmd: 'dev' }).model, 'opus');
  });
});

test('the untagged agent id is stable across calls of one session and differs between sessions', () => {
  const env = { CLAUDE_CODE_SESSION_ID: 'abcdef123456', CLAUDE_PID: '41' };
  assert.equal(agentId(env), agentId({ ...env }));
  assert.notEqual(agentId(env), agentId({ ...env, CLAUDE_PID: '42' }));
});

test('trackedDirty ignores untracked files and flags a tracked edit', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-runlog-git-'));
  const run = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
  run('init', '-q');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one');
  run('add', 'a.txt');
  run('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  fs.writeFileSync(path.join(repo, 'untracked.txt'), 'x');
  assert.equal(appendRun('demo', { cmd: 'dev' }, { root: repo }).trackedDirty, false);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'two');
  assert.equal(appendRun('demo', { cmd: 'dev' }, { root: repo }).trackedDirty, true);
});

test('selfRecordCheck: the same named agent in the same session is refused, a fresh named judge is not', () => {
  inTempDir({ VAWE_AGENT: 'author', CLAUDE_CODE_SESSION_ID: 's1' }, () => {
    appendRun('demo', { cmd: 'dev' });
    assert.equal(selfRecordCheck('demo').selfRecorded, true);
    process.env.VAWE_AGENT = 'judge-demo';
    assert.equal(selfRecordCheck('demo').selfRecorded, false);
    delete process.env.VAWE_AGENT;
    assert.equal(selfRecordCheck('demo').selfRecorded, true);
  });
});

test('ship job logs live in out/ship-jobs, named by the job id', () => {
  assert.equal(jobLogPath('demo-lx4k'), path.join('out', 'ship-jobs', 'demo-lx4k.log'));
});

test('shipVerdict: PASS needs the judge and every acceptance row, no judge gives null', () => {
  assert.equal(shipVerdict({}), null);
  assert.equal(shipVerdict({ verdict: ['judge: PASS'], acceptance: { allGreen: true } }), 'PASS');
  assert.equal(shipVerdict({ verdict: ['judge: PASS'], acceptance: { allGreen: false } }), 'FIX');
  assert.equal(shipVerdict({ verdict: ['judge: FIX'] }), 'FIX');
});

const NOW = Date.parse('2026-10-01T12:00:00Z');
const OLD = { at: '2026-09-29T10:00:00.000Z', cmd: 'render-page', agent: '72334', render: { file: '/x/out/demo-draft.mp4', frames: 90, fps: 30, ms: 20000 }, judge: null, content: null, wallMs: null };
const OLD_JUDGE = { at: '2026-09-29T10:05:00.000Z', cmd: 'judge', agent: '72334', judge: { verdict: 'FIX', file: 'x.png' } };
const NEW = [
  { at: '2026-09-30T09:00:00.000Z', cmd: 'dev', agent: 'writer', model: 'sonnet', wallS: 30, captureS: 18, acceptance: { green: 9, measured: 12, red: ['a'] } },
  { at: '2026-09-30T09:10:00.000Z', cmd: 'judge', stage: 'draft', agent: 'judge-demo', model: 'sonnet', verdict: 'FIX', scores: { hook: 9, motion: 6, type: 8 }, seconds: 28 },
  { at: '2026-09-30T09:20:00.000Z', cmd: 'dev', agent: 'writer', model: 'sonnet', wallS: 20, acceptance: { green: 12, measured: 12, red: [] } },
  { at: '2026-09-30T09:30:00.000Z', cmd: 'judge', stage: 'draft', agent: 'judge-demo', model: 'sonnet', verdict: 'PASS', scores: { hook: 9, motion: 9, type: 9 }, seconds: 27 },
  { at: '2026-09-30T10:00:00.000Z', cmd: 'ship', agent: 'writer', model: 'sonnet', verdict: 'PASS', renderS: 140, acceptance: { green: 12, measured: 12, red: [] } },
];

test('normalize reads an old render record as a draft and an old verdict as a judge', () => {
  assert.deepEqual([normalize(OLD).cmd, normalize(OLD).seconds, normalize(OLD).agent], ['dev', 20, null]);
  assert.deepEqual([normalize(OLD_JUDGE).cmd, normalize(OLD_JUDGE).verdict, normalize(OLD_JUDGE).stage], ['judge', 'FIX', 'manual']);
});

test('runs <film>: old records and new mix; no verb calls says so, the draft series and the summary line stay', () => {
  const lines = filmLines('demo', [...NEW, OLD_JUDGE, OLD].reverse());
  assert.match(lines[0], /no verb calls logged/);
  assert.match(lines.join('\n'), /quality per draft:[\s\S]*09-30 09:00\s+9\/12/);
  assert.match(lines.join('\n'), /judge totals in order: draft 23, draft 27/);
  assert.match(lines.at(-1), /^drafts 3 · median draft 20 s · PASS after 3 judge rounds · first judged total 23$/);
  assert.deepEqual(filmLines('none', []), ['none: no runs logged']);
});

test('runs <film> lists each judge round with its verdict and total, and the owner approve or reject with its note', () => {
  const owner = [{ at: '2026-09-30T11:00:00.000Z', cmd: 'approve', verdict: 'reject', note: 'type too small' }, { at: '2026-09-30T12:00:00.000Z', cmd: 'approve', verdict: 'approve', note: null }];
  const text = filmLines('demo', [...NEW, ...owner]).join('\n');
  assert.match(text, /judge 09-30 09:10 draft FIX total 23/);
  assert.match(text, /judge 09-30 09:30 draft PASS total 27/);
  assert.match(text, /owner reject 09-30 11:00: type too small/);
  assert.match(text, /owner approve 09-30 12:00\n/);
});

const call = (over) => ({ at: '2026-10-09T20:00:00.000Z', cmd: 'verb', agent: 'hud', verb: 'dev', stage: 'draft', durationS: 30, exitCode: 0, error: null, slotWaitS: 0, images: [], tagged: true, ...over });

test('runs <film>: time by stage and verb, slot wait, failures grouped by cause, untagged calls left out', () => {
  const records = [
    call({ durationS: 30, slotWaitS: 12 }),
    call({ at: '2026-10-09T20:05:00.000Z', verb: 'strip', stage: 'motion', durationS: 6, exitCode: 137, error: 'killed by SIGKILL' }),
    call({ at: '2026-10-09T20:06:00.000Z', durationS: 70, exitCode: 1, error: 'exit 1: TimeoutError: Navigation timeout of 30000 ms exceeded' }),
    call({ at: '2026-10-09T20:07:00.000Z', durationS: 5, tagged: false, agent: 'ab#12' }),
    { at: '2026-10-09T20:08:00.000Z', cmd: 'ship', agent: 'hud', verdict: 'failed', renderS: 900, reason: 'muxPageAudio: detached Frame', failedAt: 0 },
  ];
  const text = filmLines('hud', records).join('\n');
  assert.match(text, /where time went: 3 verb calls, 2 min of verb time; 1 untagged calls left out/);
  assert.match(text, /draft\s+2\s+100\s+12\s+1/);
  assert.match(text, /slot wait: 12 s over 1 calls/);
  assert.match(text, /what failed: 3 of 4 verb calls/);
  assert.match(text, /1 x killed \(strip\)/);
  assert.match(text, /1 x render slot or navigation timeout \(dev\)/);
  assert.match(text, /1 x browser lost \(ship\)/);
});

test('runs <film>: a log from before the merge and one after count the picture verbs as one frame row', () => {
  const text = filmLines('hud', [call({ verb: 'strip' }), call({ verb: 'sheet' }), call({ verb: 'frame', alias: 'still' }), call({ verb: 'frame' })]).join('\n');
  assert.match(text, /\n\s+frame\s+4\s/);
  assert.doesNotMatch(text, /\n\s+(strip|sheet)\s/);
});

test('runs <film>: the draft series marks an untagged draft', () => {
  const dev = { at: '2026-10-09T20:00:00.000Z', cmd: 'dev', wallS: 20, acceptance: { green: 7, measured: 14, red: ['jerky steps'] }, rules_fired: [{ id: 'a' }] };
  const text = filmLines('x', [{ ...dev, agent: 'hud' }, { ...dev, agent: 'ab#12', at: '2026-10-09T21:00:00.000Z' }]).join('\n');
  assert.match(text, /7\/14\s+1\s+jerky steps\n/);
  assert.match(text, /jerky steps \(untagged\)/);
});

test('runs --all: one row per film in the last 30 days, medians per model, at most 40 lines', () => {
  const films = [{ film: '_unfiled', runs: NEW }, { film: 'demo', runs: NEW }, { film: 'old', runs: [{ ...OLD, at: '2026-07-01T00:00:00.000Z' }] }, { film: 'legacy', runs: [OLD] }];
  const rows = allRows(films, NOW);
  assert.deepEqual(rows.map((r) => r.film), ['demo', 'legacy']);
  assert.deepEqual([rows[0].drafts, rows[0].medianDraftS, rows[0].firstTotal, rows[0].bestTotal, rows[0].passed, rows[0].model], [2, 25, 23, 27, true, 'sonnet']);
  const models = modelRows(rows);
  assert.deepEqual(models, [{ model: 'sonnet', films: 1, medianDrafts: 2, medianDraftS: 25, medianFirstTotal: 23, passed: 1 }]);
  const lines = allLines(rows, models);
  assert.match(lines[1], /^demo\s+2\s+25\s+23\s+27\s+yes\s+sonnet$/);
  assert.ok(lines.some((l) => l.startsWith('sonnet')));
  const many = Array.from({ length: 80 }, (_, i) => ({ film: `f${i}`, runs: [{ ...NEW[0], at: `2026-09-30T09:${String(i % 60).padStart(2, '0')}:00.000Z` }] }));
  const manyRows = allRows(many, NOW);
  assert.ok(allLines(manyRows, modelRows(manyRows)).length <= 40);
  assert.deepEqual(allLines([], []), ['no films with runs in the last 30 days']);
});

test('readAllRuns lists every <film>.runs.jsonl and drops a corrupt line', () => {
  inTempDir({ VAWE_AGENT: null }, () => {
    appendRun('a', { cmd: 'dev' });
    fs.appendFileSync(path.join('out', 'a.runs.jsonl'), 'not json\n');
    appendRun('b', { cmd: 'new' });
    assert.deepEqual(readAllRuns('out').map((f) => [f.film, f.runs.length]), [['a', 1], ['b', 1]]);
  });
});

test('filmKeyOf: a draft, a windowed draft, a final and its web copy all key to the film', async () => {
  const { filmKeyOf } = await import('../../harness/lib/runlog.mjs');
  for (const f of ['out/x-draft.mp4', 'out/x-draft-2-6.5.mp4', 'out/x.mp4', 'out/x.web.mp4', 'films/x/page.html', 'x-draft']) assert.equal(filmKeyOf(f), 'x', f);
});

test('appendRun with a root writes under <root>/out and leaves the working directory alone', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-runlog-root-'));
  inTempDir({}, () => {
    const before = process.cwd();
    appendRun('films/demo/page.html', { cmd: 'dev' }, { root });
    assert.equal(process.cwd(), before);
    assert.equal(fs.existsSync('out'), false);
  });
  assert.equal(readAllRuns(path.join(root, 'out'))[0].runs[0].film, 'demo');
  fs.rmSync(root, { recursive: true, force: true });
});

test('dev event: the phases, the checks and otherS add up to the wall time within rounding', () => {
  const checks = [['contrast', 3.14], ['sheet', 1.06]];
  const e = devEvent({ tier: 'draft', wallS: 31.44, phases: PHASES, shape: SHAPE, checks, cache: { hit: 0, miss: 2 }, rows: null });
  const total = ['startS', 'slotS', 'chromeS', 'loadS', 'prepassS', 'captureS', 'verifyS', 'encodeS', 'audioS', 'checksTotalS', 'sheetS', 'otherS'].reduce((a, k) => a + e[k], 0);
  assert.ok(Math.abs(total - e.wallS) <= 0.7, `${total} vs ${e.wallS}`);
});

test('runs <film>: one phase line per draft, and the median of each phase', () => {
  const dev = (at, over) => ({ at, cmd: 'dev', agent: 'hud', ...devEvent({ tier: 'draft', wallS: 20, phases: PHASES, shape: SHAPE, checks: [['sheet', 1]], cache: { hit: 0, miss: 1 }, rows: null, ...over }) });
  const text = filmLines('x', [dev('2026-10-09T20:00:00.000Z'), { at: '2026-10-09T19:00:00.000Z', cmd: 'dev', wallS: 9 }]).join('\n');
  assert.match(text, /^time 10-09 20:00: 20 s = start 0\.5 · chrome 0\.3 · load 1\.2 · capture 18 · verify 0\.4 · encode 0\.3 · audio 0\.6 · sheet 1 \(chrome reused, 150 frames, 10 reused\)$/m);
  assert.equal(text.match(/^time /gm).length, 1);
  const m = phaseMedians([dev('2026-10-09T20:00:00.000Z'), dev('2026-10-09T21:00:00.000Z', { phases: { ...PHASES, capture: 10.04 } }), dev('2026-10-09T22:00:00.000Z', { phases: { ...PHASES, capture: 30.04 } })].map(normalize));
  assert.deepEqual([m.drafts, m.wall, m.phases.capture], [3, 20, 18]);
  assert.match(allLines([{ film: 'a', last: 'x', drafts: 1, medianDraftS: 20, firstTotal: null, bestTotal: null, passed: false }], [], m).at(-1), /^median of 3 drafts, 20 s wall: start 0\.5 /);
  assert.equal(phaseMedians([]), null);
});

test('dev event: a plan-window render (VAWE_PLAN_WINDOW) is marked, a draft is not', () => {
  const make = () => devEvent({ tier: 'draft', wallS: 1, phases: PHASES, shape: SHAPE, checks: [], cache: { hit: 0, miss: 0 }, rows: null });
  assert.equal('planWindow' in make(), false);
  process.env.VAWE_PLAN_WINDOW = '1';
  try { assert.equal(make().planWindow, true); } finally { delete process.env.VAWE_PLAN_WINDOW; }
});
