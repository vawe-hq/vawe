import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const RUNS_SUFFIX = '.runs.jsonl';

function gitInfo(cwd) {
  try {
    const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], cwd };
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], opts).trim();
    const trackedDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], opts).trim().length > 0;
    return { git: sha || null, trackedDirty };
  } catch { return { git: null, trackedDirty: false }; }
}

/** A film's key: its file name, or its folder name for a page (films/<name>/page.html). */
export function filmKeyOf(film) {
  const name = path.basename(String(film));
  if (name === 'page.html') return path.basename(path.dirname(path.resolve(String(film))));
  return name.replace(/\.(json|mp4|webm|html)$/, '').replace(/\.web$/, '').replace(/-draft(-[\d.]+-[\d.]+)?$/, '');
}

/** out/<film-key>.runs.jsonl for a scene path, a page path or a bare film name. */
export function runsPathFor(film, root = '.') {
  return path.join(root, 'out', `${filmKeyOf(film)}${RUNS_SUFFIX}`);
}

// An Agent-tool subagent shares the session id and CLAUDE_PID with its parent (measured 2026-09-27), so
// only VAWE_AGENT names an agent. Without it the id is the session plus a tag stable over the session's
// commands, and `namedAgent` tells it from a real name by the "#".
export function agentId(env = process.env) {
  if (env.VAWE_AGENT) return env.VAWE_AGENT;
  const session = env.CLAUDE_CODE_SESSION_ID;
  const tag = createHash('sha1').update(`${session ?? ''}:${env.CLAUDE_PID ?? process.ppid}`).digest('hex').slice(0, 4);
  return `${session ? session.slice(0, 8) : 'shell'}#${tag}`;
}

// CLAUDE_CODE_SUBAGENT_MODEL is the only model name Claude Code puts in a Bash call's environment (inspected 2026-10-28).
export const modelId = (env = process.env) => env.VAWE_MODEL || env.CLAUDE_CODE_SUBAGENT_MODEL || null;

/** The agent id when a person or a brief chose it (VAWE_AGENT), else null. Old records hold a CLAUDE_PID, which counts as a name. */
export const namedAgent = (agent) => (agent && !String(agent).includes('#') ? String(agent) : null);

/** appendRun(film, event, { root }): write one JSON line to <root>/out, the event's own fields after the common ones (harness/lib/run-events.mjs builds them). `root` is also the repo the git stamp reads. */
export function appendRun(film, event = {}, { root } = {}) {
  const { git, trackedDirty } = gitInfo(root);
  const line = {
    at: new Date().toISOString(),
    cmd: event.cmd || 'unknown',
    film: filmKeyOf(film),
    session: process.env.CLAUDE_CODE_SESSION_ID || null,
    agent: agentId(),
    model: modelId(),
    git,
    trackedDirty,
    ...event,
  };
  const out = runsPathFor(film, root);
  fs.mkdirSync(path.dirname(out) || '.', { recursive: true });
  fs.appendFileSync(out, JSON.stringify(line) + '\n');
  return line;
}

const parseRuns = (text) => text.split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

/** readRuns(film) -> every logged run, oldest first. A corrupt line is dropped, not thrown. */
export function readRuns(film, root = '.') {
  const p = runsPathFor(film, root);
  return fs.existsSync(p) ? parseRuns(fs.readFileSync(p, 'utf8')) : [];
}

/** The mp4 the last successful `vawe dev` of a film wrote, wherever --out put it, or null when none is logged or the file is gone. */
export function lastDraft(film, root = '.') {
  const file = readRuns(film, root).findLast((r) => r.cmd === 'dev' && !r.failed && r.file)?.file;
  return file && fs.existsSync(file) ? file : null;
}

/** readAllRuns(dir) -> [{ film, runs }] for every <film>.runs.jsonl in dir, by film name. */
export function readAllRuns(dir = 'out') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(RUNS_SUFFIX)).sort()
    .map((f) => ({ film: f.slice(0, -RUNS_SUFFIX.length), runs: parseRuns(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

const HOOK_NAME = 'log-read.mjs';
const settingsFiles = (root, home) => [path.join(root, '.claude', 'settings.json'), path.join(root, '.claude', 'settings.local.json'), path.join(home, '.claude', 'settings.json')];

/** True when the log-read hook has left a read event in any film's log, or a settings file names it: false means the hook is missing, not that nothing was looked at. */
export function readHookSeen(root = '.', home = os.homedir()) {
  if (readAllRuns(path.join(root, 'out')).some((f) => f.runs.some((r) => r.cmd === 'read'))) return true;
  return settingsFiles(root, home).some((f) => { try { return fs.readFileSync(f, 'utf8').includes(HOOK_NAME); } catch { return false; } });
}

/** The images a film's `verb` calls printed since `sinceMs` and which of them no Read event (in any film's log: a custom --out folder files its reads under another name) has opened since: { printed, unread }, absolute paths. */
export function looksSince(film, verb, sinceMs, root = '.') {
  const abs = (p) => path.resolve(root, p);
  const printed = [...new Set(readRuns(film, root)
    .filter((r) => r.cmd === 'verb' && r.verb === verb && r.exitCode === 0 && Date.parse(r.start ?? r.at) > sinceMs)
    .flatMap((r) => r.images ?? []).map(abs))];
  const opened = new Set(readAllRuns(path.join(root, 'out'))
    .flatMap((f) => f.runs).filter((r) => r.cmd === 'read' && Date.parse(r.at) >= sinceMs).map((r) => abs(r.image)));
  return { printed, unread: printed.filter((p) => !opened.has(p)) };
}
