// The media slots of a template: the pictures and clips a person swaps in with `vawe new <name> --template <id> --slot key=path`.
// The card lists them in template.json `slots`; this file reads that list and checks what the person passed. Pure.
import path from 'node:path';
import os from 'node:os';

export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp'];
export const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm', 'mkv'];
const KINDS = ['image', 'video'];
const SIZE = /^([1-9]\d{1,4})x([1-9]\d{1,4})$/;

const extOf = (file) => path.extname(file).slice(1).toLowerCase();

/** 'image', 'video' or null, by the file's extension. */
export const kindOfFile = (file) => (IMAGE_EXT.includes(extOf(file)) ? 'image' : VIDEO_EXT.includes(extOf(file)) ? 'video' : null);

/** { width, height } of "1600x1000", or null. */
export function parseSize(size) {
  const m = SIZE.exec(String(size));
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

const safeRelative = (p) => typeof p === 'string' && p !== '' && !path.isAbsolute(p) && !p.includes('\\') && !p.split('/').includes('..');

const WORDS = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (v) => typeof v === 'string' && v !== '';

function fileProblem(s) {
  if (!safeRelative(s.file) || !s.file.startsWith('assets/')) return 'file must be a relative path under assets/';
  return kindOfFile(s.file) === s.kind ? null : `file ${s.file} is not a ${s.kind} file`;
}

function spanProblem(s) {
  if (s.span === undefined) return null;
  return s.kind === 'video' && Number.isFinite(s.span) && s.span > 0 ? null : 'span is seconds, a number above 0, and only a video slot has one';
}

/** The problem with one slot as a line, or null. `kind` and the `file` extension must agree; a video slot may name a `span` in seconds. */
function slotProblem(s) {
  if (!WORDS.test(s?.key ?? '')) return 'key must be lowercase words joined by dashes';
  if (!text(s.label)) return 'label is required';
  if (!text(s.where)) return 'where is required';
  if (!KINDS.includes(s.kind)) return 'kind must be image or video';
  if (!parseSize(s.size)) return 'size must look like 1600x1000';
  return fileProblem(s) ?? spanProblem(s);
}

/** The problem with a card's `slots` list as one line, or null. */
export function slotListProblem(slots) {
  if (slots === undefined) return null;
  if (!Array.isArray(slots)) return 'slots must be a list';
  const keys = new Set();
  for (const [i, s] of slots.entries()) {
    const problem = slotProblem(s) ?? (keys.has(s.key) ? `key ${s.key} is used twice` : null);
    if (problem) return `slots[${i}]${s?.key ? ` (${s.key})` : ''}: ${problem}`;
    keys.add(s.key);
  }
  return null;
}

/** The `--slot` values as [{ key, path }]. A value is key=path; the path keeps any later "=". `~/` is the home folder. */
export function parseSlotArgs(values, home = os.homedir()) {
  return values.map((v) => {
    const at = v.indexOf('=');
    if (at < 1 || at === v.length - 1) throw new Error(`--slot "${v}" must be key=path, for example --slot screen-1=~/shots/app.png`);
    const file = v.slice(at + 1);
    return { key: v.slice(0, at), path: file === '~' || file.startsWith('~/') ? path.join(home, file.slice(1)) : file };
  });
}

/**
 * Matches each assignment to a slot of the card. `kindOf(path)` reads the file's kind. Returns [{ slot, path }] or throws an Error
 * whose message names the valid keys, so the caller turns it into a usage error. Pure.
 */
export function planSlots(card, assigned, kindOf = kindOfFile) {
  const slots = card?.slots ?? [];
  const names = slots.map((s) => s.key).join(', ');
  const seen = new Set();
  return assigned.map(({ key, path: file }) => {
    if (!slots.length) throw new Error(`this template has no media slots, so --slot ${key} has nowhere to go`);
    const slot = slots.find((s) => s.key === key);
    if (!slot) throw new Error(`unknown slot "${key}": the slots of this template are ${names}`);
    if (seen.has(key)) throw new Error(`slot ${key} is given twice`);
    seen.add(key);
    const kind = kindOf(file);
    if (kind !== slot.kind) throw new Error(`slot ${key} takes ${slot.kind === 'image' ? `an image (${IMAGE_EXT.join(', ')})` : `a video (${VIDEO_EXT.join(', ')})`}, but ${path.basename(file)} is ${kind ? `a${kind === 'image' ? 'n image' : ' video'}` : 'not a file type vawe reads'}`);
    return { slot, path: file };
  });
}

/** The slots a person left as the template's placeholder, as lines. */
export function placeholderLines(card, planned) {
  const done = new Set(planned.map((p) => p.slot.key));
  const left = (card?.slots ?? []).filter((s) => !done.has(s.key));
  if (!left.length) return [];
  return ['', 'still placeholders (replace with --slot key=path, or put your file at the path):', ...left.map((s) => `  ${s.key}: ${s.label}, ${s.kind} ${s.size}, ${s.file}`)];
}
