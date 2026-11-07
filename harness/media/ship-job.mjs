// harness/media/ship-job.mjs: run a final render in the background and report on it.
//
//   node harness/media/ship-job.mjs start <page.html> [render-page args]   detach a final render, print its job id
//   node harness/media/ship-job.mjs status [job] [--wait]                  progress, or the result (default: newest job);
//                                                                          --wait blocks until the job ends or 3.5 minutes pass,
//                                                                          one progress line per minute
//   node harness/media/ship-job.mjs wait <page|film>                       the same wait for any render of the film: a running ship job,
//                                                                          else a draft or clip holding a render slot; prints its result line
//
// A job is two files in out/ship-jobs, <id>.json (state) and <id>.log (the render's own output); the id starts with the film name. The
// detached `run` process owns the state file: it starts render-page.mjs --final, then records how it ended and,
// on success, the result of the cheap final check (scene-stats plus a blank-frame scan) and of a fresh
// judge on the final (harness/media/judge-fresh.mjs, about 30 s; VAWE_SHIP_JUDGE=0 skips it). The mp4 is final
// and listed as `rendered` (status judging) before the judge and the acceptance run; `done` adds the verdict. The job writes the
// `ship` event of out/<film>.runs.jsonl when it ends, so the render runs with --job and logs nothing itself.
// A new job cancels the running job for the same page, params and aspect. `status <page>` reports the newest job of that render.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defaultOut } from './render-page.mjs';
import { pageQuery } from '../lib/page-params.mjs';
import { videoProblems, readVideo } from './draft-check.mjs';
import { pageAuthoring } from '../lib/motion-stamp.mjs';
import { WAIT_WORK } from '../live/stage-say.mjs';
import { doneLines, shipVerdict, SHIP_JOBS_DIR, jobLogPath, finalFailure, failedShipLine, firstCapture, captureEtaMs, waitCallsLeft, sameRender } from '../lib/ship-status.mjs';
import { appendRun, filmKeyOf } from '../lib/runlog.mjs';
import { waitForFilm, WAIT_CAP_DEFAULT_MS, stillRunningLine, waitExitCode } from '../lib/render-wait.mjs';
import { shipEvent } from '../lib/run-events.mjs';
import { EXIT, fail } from '../lib/exit-codes.mjs';
import { finalAcceptance, lastPageFacts } from './acceptance-run.mjs';
import { transition, isTerminal, runnerLost } from '../lib/job-state.mjs';

// An agent tool call stalls at its 10 minute watchdog; 3.5 minutes leaves a wide margin.
const WAIT_CAP_MS = Number(process.env.VAWE_SHIP_WAIT_MS) || WAIT_CAP_DEFAULT_MS;
const PROGRESS_MS = Number(process.env.VAWE_SHIP_PROGRESS_MS) || 60_000;

const SELF = fileURLToPath(import.meta.url);
const RENDER = path.join(path.dirname(SELF), 'render-page.mjs');
const JUDGE = path.join(path.dirname(SELF), 'judge-fresh.mjs');
const jobsDir = () => { fs.mkdirSync(SHIP_JOBS_DIR, { recursive: true }); return path.resolve(SHIP_JOBS_DIR); };
const stateFile = (id) => path.join(jobsDir(), `${id}.json`);
const readJob = (id) => JSON.parse(fs.readFileSync(stateFile(id), 'utf8'));
const writeJob = (job) => {
  const tmp = `${stateFile(job.id)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(job));
  fs.renameSync(tmp, stateFile(job.id));
};

const die = (msg, code = EXIT.USAGE) => fail(code, `ship: ${msg}`);
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const clock = (ms) => `${Math.round(ms / 1000)}s`;

function allJobs() {
  return fs.readdirSync(jobsDir()).filter((f) => f.endsWith('.json')).map((f) => readJob(f.slice(0, -5)));
}

const jobFilm = (page) => path.basename(defaultOut(page, { aspect: '16:9', final: true }), '.mp4');

function cancelRunning(page) {
  for (const old of allJobs()) {
    if (!['starting', 'running'].includes(old.status) || !sameRender(old, page, jobFilm(page))) continue;
    if (old.pid && pidAlive(old.pid)) process.kill(-old.pid, 'SIGTERM');
    const cancelled = transition(old, 'cancelled', { endedAt: Date.now() });
    if (cancelled) writeJob(cancelled);
    console.log(`cancelled the running job ${old.id} for the same render`);
  }
}

function startJob(page, renderArgs) {
  if (!fs.existsSync(page)) die(`no such page: ${page}`, EXIT.IO);
  const query = pageQuery().slice(1);
  cancelRunning(page);
  const name = jobFilm(page);
  const id = `${name}-${Date.now().toString(36)}`;
  const log = path.resolve(jobLogPath(id));
  writeJob({ id, page, film: name, query, args: renderArgs, log, status: 'starting', startedAt: Date.now(), judge: process.env.VAWE_SHIP_JUDGE !== '0' });
  const runner = spawn(process.execPath, [SELF, 'run', id], { detached: true, stdio: 'ignore' });
  runner.unref();
  const fresh = readJob(id);
  if (fresh.status === 'starting') writeJob({ ...fresh, pid: runner.pid });
  console.log(`job ${id} started: final render of ${page} in the background`);
  console.log(`log: ${log}`);
  console.log(`status: bin/vawe wait ${page}`);
  console.log(`work: ${WAIT_WORK}`);
}

function runJob(id) {
  const job = readJob(id);
  const running = transition(job, 'running', { pid: process.pid });
  if (!running) return;
  writeJob(running);
  const fd = fs.openSync(job.log, 'a');
  const child = spawn(process.execPath, [RENDER, job.page, ...job.args, '--final', '--progress', '--job'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let started = false;
  let verdictLater = null;
  const masterReady = () => {
    const checked = { ...readJob(id), renderMs: Date.now() - job.startedAt, ...finalCheck(outputsOf(logText(job)), pageAuthoring(job.page)) };
    if (!checked.outputs.length) return;
    const judging = transition(checked, 'judging');
    if (!judging) return;
    writeJob(judging);
    verdictLater = new Promise((resolve) => (checked.judge ? judgeFinal(checked, resolve) : resolve(null)));
  };
  const relay = (chunk) => {
    fs.writeSync(fd, chunk);
    if (!verdictLater && /(^|[\r\n])✓ /.test(String(chunk))) masterReady();
    const first = started ? null : firstCapture(String(chunk));
    if (!first) return;
    started = true;
    writeJob({ ...readJob(id), capture: { first, at: Date.now() } });
  };
  child.stdout.on('data', relay);
  child.stderr.on('data', relay);
  child.on('close', async (code) => {
    if (code !== 0) {
      const failure = { ...finalFailure(logText(job), `exit ${code}`), page: job.page };
      const failed = transition(readJob(id), 'failed', { exit: code, endedAt: Date.now(), failure });
      if (!failed) return;
      appendRun(job.page, shipEvent({ verdict: 'failed', renderS: (Date.now() - job.startedAt) / 1000, failure }));
      return writeJob(failed);
    }
    if (!verdictLater) return finishJob(id, { ...readJob(id), renderMs: Date.now() - job.startedAt, ...finalCheck([], null) });
    const verdict = await verdictLater;
    finishJob(id, { ...readJob(id), ...(verdict ? { verdict } : {}) });
  });
}

async function finishJob(id, job) {
  const acceptance = job.outputs.length ? await finalAcceptance(job).then((a) => ({ acceptance: a }), (e) => ({ acceptanceError: e.message })) : {};
  const done = transition(readJob(id), 'done', { ...job, ...acceptance, status: 'done', endedAt: Date.now() });
  if (!done) return;
  appendRun(job.page, shipEvent({ verdict: shipVerdict(done), renderS: job.renderMs / 1000, acceptance: done.acceptance?.counts }));
  writeJob(done);
}

function judgeFinal(job, done) {
  const brief = path.join(path.dirname(job.page), 'brief.md');
  const args = [JUDGE, job.outputs[0], '--stage', 'final', ...(fs.existsSync(brief) ? ['--brief', brief] : [])];
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => done(verdictLines(out, code)));
}

const verdictLines = (text, code) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !/^(next:|PASS$|FIX$)/.test(l.trim()));
  return code === 0 ? lines : [`judge failed (exit ${code})`, ...lines.slice(-3)];
};

const outputsOf = (text) => text.split(/[\r\n]+/).filter((l) => l.startsWith('✓ ')).map((l) => l.slice(2).split(':')[0]);

const filmName = (mp4) => path.basename(mp4).replace(/\.(web\.)?mp4$/, '').replace(/-draft$/, '');

function finalCheck(outputs, authoring) {
  try {
    const problems = outputs.flatMap((mp4) => videoProblems(readVideo(mp4), authoring, lastPageFacts(filmName(mp4))).map((p) => (outputs.length > 1 ? `${path.basename(mp4)}: ${p}` : p)));
    return { outputs, problems };
  } catch (e) {
    return { outputs, problems: [], checkError: e.message };
  }
}

function newestJob() {
  const ids = fs.readdirSync(jobsDir()).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  ids.sort((a, b) => fs.statSync(stateFile(b)).mtimeMs - fs.statSync(stateFile(a)).mtimeMs);
  return ids[0];
}

function logText(job) {
  try { return fs.readFileSync(job.log, 'utf8'); } catch { return ''; }
}

function progress(job, text) {
  const seen = [...text.matchAll(/capturing (\d+)\/(\d+) subframe/g)].pop();
  const elapsed = Date.now() - job.startedAt;
  if (!seen) return { line: `job ${job.id}: running, ${clock(elapsed)} in, before capture (page load, checks, speed pass)`, etaMs: null, elapsed };
  const [done, total] = [Number(seen[1]), Number(seen[2])];
  const etaMs = job.capture ? captureEtaMs({ first: job.capture.first, firstAt: job.capture.at, done, total, now: Date.now() }) : null;
  const eta = etaMs === null ? 'not known yet' : `about ${clock(etaMs)}`;
  return { line: `job ${job.id}: running, ${done}/${total} subframes (${Math.round((100 * done) / total)}%), ${clock(elapsed)} in, ${eta} left, then encode`, etaMs, elapsed };
}

const progressLine = (job, text) => progress(job, text).line;

/** The next: line of a job still running: the command, and how many calls it needs at the current pace. */
function waitNextLine(job, text) {
  const { etaMs, elapsed } = progress(job, text);
  const { calls, basis } = waitCallsLeft({ etaMs, elapsedMs: elapsed, capMs: WAIT_CAP_MS });
  return `next: bin/vawe wait ${job.page} (about ${calls} more ${calls === 1 ? 'call' : 'calls'} ${basis}; one call waits up to ${clock(WAIT_CAP_MS)}; run it alone, not in parallel); ${WAIT_WORK}`;
}

const LINE_CAP = 240;

function errorLines(text) {
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l && !l.includes('capturing '));
  const errors = lines.filter((l) => /^✗|error|failed/i.test(l));
  return (errors.length ? errors : lines).slice(-4).map((l) => (l.length > LINE_CAP ? `${l.slice(0, LINE_CAP)}...` : l));
}

function finalLines(job, text) {
  if (job.status === 'done') return doneLines(job);
  if (job.status === 'cancelled') return [`job ${job.id}: cancelled, a newer job for the same page replaced it`];
  return [failedLine(job, text, `exit ${job.exit}`), `job ${job.id}: failed (exit ${job.exit}) after ${clock(job.endedAt - job.startedAt)}`, ...errorLines(text), `full log: ${job.log}`];
}

function failedLine(job, text, fallback) {
  const { pct, reason } = job.failure ?? finalFailure(text, fallback);
  return failedShipLine(filmKeyOf(job.page), { failedAt: pct, reason, page: job.page });
}

function newestJobFor(page) {
  const jobs = allJobs().filter((j) => sameRender(j, page, jobFilm(page))).sort((a, b) => b.startedAt - a.startedAt);
  return jobs[0]?.id;
}

const resolveTarget = (arg) => (arg && fs.existsSync(arg) && arg.endsWith('.html') ? newestJobFor(arg) : arg) || newestJob();

function statusOf(id) {
  const target = resolveTarget(id);
  if (!target) die('no ship job yet: start one with vawe ship <page>', EXIT.IO);
  if (!fs.existsSync(stateFile(target))) die(`no such job: ${target}`, EXIT.IO);
  const job = readJob(target);
  const text = logText(job);
  if (isTerminal(job.status)) return finalLines(job, text);
  if (runnerLost(job, pidAlive)) return [failedLine(job, text, 'the render process died without a result'), `job ${job.id}: the render process died without a result`, `log: ${job.log}`];
  if (job.status === 'judging') return renderedLines(job);
  return [progressLine(job, text), waitNextLine(job, text), `log: ${job.log}`];
}

const renderedLines = (job) => [
  `job ${job.id}: RENDERED in ${clock(job.renderMs)}, the mp4 is ready; NOT JUDGED yet (a fresh judge and the acceptance rows run now, about 70 s)`,
  ...job.outputs.map((o) => `output: ${o}`),
  `next: bin/vawe wait ${job.page} (1 more call: the judge and the acceptance rows end within about 70 s)`,
];

const isOver = (id) => { const job = readJob(id); return isTerminal(job.status) || runnerLost(job, pidAlive); };

async function waitThenStatus(id) {
  const target = resolveTarget(id);
  const until = Date.now() + WAIT_CAP_MS;
  let announced = false;
  let nextProgress = Date.now() + PROGRESS_MS;
  if (target && fs.existsSync(stateFile(target)) && !isOver(target)) console.log(`${statusOf(target)[0]} (waiting up to ${clock(WAIT_CAP_MS)} in this call)`);
  while (target && fs.existsSync(stateFile(target)) && !isOver(target) && Date.now() < until) {
    if (!announced && readJob(target).status === 'judging') { announced = true; console.log(renderedLines(readJob(target)).join('\n')); }
    if (Date.now() >= nextProgress) { nextProgress += PROGRESS_MS; console.log(statusOf(target)[0]); }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(statusOf(target).join('\n'));
  const running = Boolean(target && fs.existsSync(stateFile(target)) && !isOver(target));
  if (running) console.log(stillRunningLine(`bin/vawe wait ${readJob(target).page}`, WAIT_CAP_MS));
  else if (target && fs.existsSync(stateFile(target)) && readJob(target).status === 'failed') process.exitCode = 1;
}

const activeJobFor = (film) => allJobs().filter((j) => filmKeyOf(j.page) === filmKeyOf(film) && !isOver(j.id) && j.status !== 'cancelled').sort((a, b) => b.startedAt - a.startedAt)[0];

async function waitForRender(film) {
  const job = activeJobFor(film);
  if (job) return waitThenStatus(job.id);
  const { running, result } = await waitForFilm(film, { capMs: WAIT_CAP_MS, progressMs: PROGRESS_MS });
  if (running) console.log(stillRunningLine(`bin/vawe wait ${filmKeyOf(film)}`, WAIT_CAP_MS));
  else console.log(result ?? `vawe wait: no render of ${filmKeyOf(film)} is running and no result is logged yet`);
  process.exitCode = waitExitCode({ running, result });
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'start') startJob(rest[0], rest.slice(1));
else if (mode === 'run') runJob(rest[0]);
else if (mode === 'wait') await waitForRender(rest[0]);
else if (mode === 'status') {
  const [id] = rest.filter((a) => a !== '--wait');
  if (rest.includes('--wait')) await waitThenStatus(id);
  else console.log(statusOf(id).join('\n'));
} else die('usage: ship-job.mjs start <page> [args] | status [job] [--wait] | wait <page|film>');
