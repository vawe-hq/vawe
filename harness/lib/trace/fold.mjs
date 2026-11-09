import { brief } from './redact.mjs';
import { adviceOf, commandVerbs, docsRead, filmWrites, footersOf, lookupMissed, lookupOf, namedVerbs, newFilm, nextNamed, nextPlacement, rawTools, resultFlags, textOf } from './calls.mjs';

const stampOf = (row) => Date.parse(row.timestamp);

function newCall(block, ms, index) {
  const input = block.input ?? {};
  const verbs = block.name === 'Bash' ? commandVerbs(input.command ?? '') : [];
  return {
    index, id: block.id, name: block.name, ms,
    cmd: brief(input.command ?? input.file_path ?? input.pattern ?? input.skill ?? input.description ?? '', 200),
    verbs,
    raw: block.name === 'Bash' ? rawTools(input.command ?? '', verbs.length > 0) : [],
    docs: docsRead(block.name, input),
    writes: filmWrites(block.name, input),
    lookup: lookupOf(block.name, input),
    newFilm: newFilm(verbs),
    unattended: /VAWE_UNATTENDED=1/.test(input.command ?? ''),
    label: (input.command ?? '').match(/VAWE_AGENT=(\S+)/)?.[1] ?? null,
  };
}

function settle(call, block, ms) {
  const text = textOf(block.content);
  call.resultMs = ms;
  call.chars = text.length;
  call.flags = resultFlags(text, block.is_error);
  call.footers = footersOf(text);
  call.advice = adviceOf(text);
  call.next = call.verbs.length ? nextNamed(text) : [];
  call.nextAt = call.verbs.length ? nextPlacement(text) : [];
  if (call.lookup) call.lookup.missed = lookupMissed(call.lookup, text);
  call.lastLine = brief(text.split('\n').filter(Boolean).at(-1) ?? '', 160);
}

function noteAttachment(fold, attachment) {
  const call = fold.byId.get(attachment.toolUseID);
  if (attachment.type === 'hook_blocking_error') {
    if (call) call.blockedByHook = brief(attachment.blockingError?.blockingError ?? '', 160);
    fold.hookBlocks += call ? 0 : 1;
  } else if (attachment.type === 'hook_non_blocking_error') {
    fold.hookErrors += 1;
  } else if (attachment.type === 'hook_additional_context') {
    const text = [].concat(attachment.content ?? []).join(' ');
    fold.hints.push({ source: attachment.hookName ?? attachment.hookEvent ?? '?', afterCall: call ? call.index : fold.calls.length - 1, text: brief(text, 220), named: namedVerbs(text) });
  }
}

const META_KEYS = { session: 'sessionId', agent: 'agentId', cwd: 'cwd', branch: 'gitBranch', version: 'version' };

const IDLE_GAP_MS = 10 * 60 * 1000;
export const STALL_GAP_MS = 5 * 60 * 1000;
const CUT_OFF = /^(?:\[Request interrupted by user|Your response above was cut off)/;

const NOT_A_NOTE = /^(?:<system-reminder>|<task-notification|\[Image)/;

const blocksOf = (row) => (Array.isArray(row.message?.content) ? row.message.content : []);

/** The plain text a user row carries, or null when the row only carries tool results. Pure. */
export function userTextOf(row) {
  if (row.type !== 'user' || !row.message) return null;
  const { content } = row.message;
  if (typeof content === 'string') return content;
  const texts = blocksOf(row).filter((b) => b.type === 'text').map((b) => b.text ?? '');
  return texts.length ? texts.join('\n') : null;
}

function gapKind(row) {
  if (row.type === 'assistant') return 'model';
  if (row.type !== 'user') return 'other';
  const text = userTextOf(row);
  if (text === null) return 'tool';
  return CUT_OFF.test(text.trim()) ? 'cutoff' : 'wait';
}

function noteGap(fold, row, ms) {
  const { meta } = fold;
  if (meta.lastMs === undefined || Number.isNaN(ms)) return;
  const kind = gapKind(row);
  const dt = Math.max(0, ms - meta.lastMs);
  if (dt >= STALL_GAP_MS) fold.gaps.push({ startMs: meta.lastMs, endMs: ms, kind });
  if (dt < IDLE_GAP_MS || kind === 'tool') fold.active.push({ ms, dt });
}

function noteMeta(meta, row, ms) {
  if (!Number.isNaN(ms)) {
    meta.lastMs = ms;
    meta.startMs = Math.min(meta.startMs ?? ms, ms);
    meta.endMs = Math.max(meta.endMs ?? ms, ms);
  }
  for (const [key, field] of Object.entries(META_KEYS)) meta[key] ??= row[field];
}

function noteUserText(fold, row, ms) {
  const text = userTextOf(row);
  if (text === null || Number.isNaN(ms)) return;
  const trimmed = text.trim();
  if (!fold.sawPrompt) {
    fold.sawPrompt = true;
    return;
  }
  if (CUT_OFF.test(trimmed)) fold.afterCutOff = true;
  if (CUT_OFF.test(trimmed) || NOT_A_NOTE.test(trimmed)) return;
  if (fold.afterCutOff) return;
  fold.notes.push({ ms, prevMs: fold.meta.lastMs ?? ms, text: brief(text, 400) });
}

function noteUsage(fold, id, usage, ms) {
  const seen = fold.usage.get(id);
  fold.usage.set(id, { ...usage, output_tokens: Math.max(seen?.output_tokens ?? 0, usage.output_tokens ?? 0) });
  if (!fold.usageAt.has(id)) fold.usageAt.set(id, { ms, cacheWrite: usage.cache_creation_input_tokens ?? 0, cacheRead: usage.cache_read_input_tokens ?? 0 });
}

function noteMessage(fold, row, ms) {
  const { message } = row;
  if (row.type === 'assistant') {
    if (message.model && message.model !== '<synthetic>') fold.meta.models.add(message.model);
    if (message.usage) noteUsage(fold, message.id ?? row.uuid, message.usage, ms);
  }
  for (const block of Array.isArray(message.content) ? message.content : []) {
    if (block.type === 'tool_use') {
      const call = newCall(block, ms, fold.calls.length);
      fold.calls.push(call);
      fold.byId.set(block.id, call);
    } else if (block.type === 'tool_result' && fold.byId.has(block.tool_use_id)) {
      settle(fold.byId.get(block.tool_use_id), block, ms);
    }
  }
}

/** Reads the rows of one transcript into the raw record the analysers use: meta, calls (no result text kept), hints, tokens. */
export async function foldRows(rows) {
  const fold = { meta: { models: new Set() }, calls: [], byId: new Map(), hints: [], hookErrors: 0, hookBlocks: 0, usage: new Map(), usageAt: new Map(), gaps: [], active: [], notes: [] };
  for await (const row of rows) {
    const ms = stampOf(row);
    if (row.type === 'assistant') fold.afterCutOff = false;
    noteGap(fold, row, ms);
    noteUserText(fold, row, ms);
    noteMeta(fold.meta, row, ms);
    if (row.type === 'attachment' && row.attachment) noteAttachment(fold, row.attachment);
    else if (row.message) noteMessage(fold, row, ms);
  }
  return fold;
}
