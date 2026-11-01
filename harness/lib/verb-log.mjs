// One log entry and one last output line per `bin/vawe` call. Pure: bin/vawe owns the process and the clock.
import fs from 'node:fs';
import { filmKeyOf, namedAgent, agentId } from './runlog.mjs';

export const UNFILED = '_unfiled';
const IMAGE = /(?:^|[\s(`"'=])((?:~\/|\/|\.\/|[\w.-]+\/)[^\s`"')|]*\.(?:png|jpe?g|webp))(?=$|[\s)`"'|,;:])/gi;
const MAX_IMAGES = 20;
const MAX_REASON = 260;

/** The film a call is about: the page or mp4 it names (`new` names the film itself); UNFILED when it names none. */
export function filmOfCall(verb, positional, args = []) {
  if (verb === 'new' && positional[0]) return filmKeyOf(positional[0]);
  if (verb === 'moves' && args.includes('--only')) return args[args.indexOf('--only') + 1];
  const file = positional.find((p) => /\.(html|mp4|webm)$/i.test(p));
  return file ? filmKeyOf(file) : UNFILED;
}

/** The image paths a verb printed for the agent to Read, in order, once each. */
export function imagesIn(text) {
  const seen = new Set();
  for (const m of String(text).matchAll(IMAGE)) {
    seen.add(m[1]);
    if (seen.size >= MAX_IMAGES) break;
  }
  return [...seen];
}

/** Why a call failed, in one line: the last meaningful stderr line, else the exit code or signal. */
export function reasonOf({ code, signal, stderr = '' }) {
  const line = String(stderr).split('\n').map((l) => l.trim()).filter((l) => l && !/^at /.test(l) && !/^Node\.js v\d/.test(l)).at(-1);
  const how = signal ? `killed by ${signal}` : `exit ${code}`;
  return line ? `${how}: ${line.slice(0, MAX_REASON)}` : how;
}

const CAUSES = [
  [/render slot|Navigation timeout/i, 'render slot or navigation timeout'],
  [/detached Frame|Target closed|shared browser|lost its page|Protocol error \([^)]*\): (Target|Session|Connection) closed|protocolTimeout/i, 'browser lost'],
  [/killed by|exit 137/i, 'killed'],
  [/no such|missing|usage|unknown verb|not a valid|needs --/i, 'bad arguments'],
];

/** A short key that groups failures of one cause. */
export function causeOf(reason) {
  const hit = CAUSES.find(([re]) => re.test(reason ?? ''));
  return hit ? hit[1] : String(reason ?? 'unknown').replace(/^exit \d+: /, '').replace(/\d+(\.\d+)?/g, '#').slice(0, 50);
}

const tenths = (s) => Math.round(s * 10) / 10;

/** The reason a verb refused to run, from its `vawe: <verb> refused: <reason>` stderr line; null when it did not refuse. */
export function refusalOf(stderr = '') {
  return /^vawe: \S+ refused: (.+)$/m.exec(stderr)?.[1] ?? null;
}

/** The runs.jsonl fields of one call. `pageHash` is the digest of the page the call concerned (the ship gate reads it on a critique). `fresh` marks a critique a separate claude session wrote (`critique --fresh`). `stage` is the loop stage of the call (verbStage, else stage-say's stage for the film); `tagged` is false for a run no VAWE_AGENT names. `help` marks a `<verb> --help` lookup, `usage` a call the argument parser rejected, `refused` the reason a verb declined to run. */
export function verbEvent({ verb, args, stage = null, startMs, endMs, exitCode, reason = null, slotWaitS = null, images = [], pageHash = null, fresh = false, help = false, usage = false, refused = null, env = process.env }) {
  return {
    cmd: 'verb', verb, args, stage,
    start: new Date(startMs).toISOString(), durationS: tenths((endMs - startMs) / 1000),
    exitCode, error: exitCode === 0 ? null : reason, slotWaitS: slotWaitS == null ? null : tenths(slotWaitS),
    images, tagged: namedAgent(agentId()) !== null,
    ...(pageHash ? { pageHash } : {}),
    ...(fresh ? { fresh: true } : {}),
    ...(help ? { help: true } : {}),
    ...(usage ? { usage: true } : {}),
    ...(refused ? { refused } : {}),
    ...(verb === 'ship' && env.VAWE_UNATTENDED === '1' ? { unattended: true } : {}),
  };
}

/** The last line of every call: survives a tail, a head -1 never needed. */
export function footerLine({ verb, code, reason, seconds }) {
  return code === 0 ? `vawe: ${verb} ok in ${seconds.toFixed(1)}s` : `vawe: ${verb} FAILED (${reason}) in ${seconds.toFixed(1)}s`;
}

export const verbRanSince = (records, verb, sinceMs) => records.some((r) => r.cmd === 'verb' && r.verb === verb && r.exitCode === 0 && Date.parse(r.start ?? r.at) > sinceMs);

/** A child script reports a fact about its call (`slotWaitS`) to the bin/vawe process that started it, through the file VAWE_VERB_NOTES names. A detached job outlives the verb that removed the file; with no reader left the note is dropped. */
export function noteVerb(fields, env = process.env) {
  if (!env.VAWE_VERB_NOTES) return;
  try {
    fs.appendFileSync(env.VAWE_VERB_NOTES, `${JSON.stringify(fields)}\n`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

/** The merged notes of a call, later lines winning; {} when the file is missing. */
export function readNotes(file) {
  try {
    return Object.assign({}, ...fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  } catch { return {}; }
}
