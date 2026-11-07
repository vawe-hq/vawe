// The judge ledger: every fix a fresh judge asks for gets an id and stays in out/<name>.judge.json. The
// next judge of the film marks each open one fixed, partly, still or stale (a fault the sheet no longer shows) before it adds new ones, and says
// why when a new fix reverses an old one. Every item carries the rule id it traces to (taste/rules), and a
// failing note of a rule that has an open item stays that item. A target is a rule id, else its "what". Each fix names what it changes, its value now and the value it
// wants, so the next judge starts from numbers, and a target the judges move back and forth over three
// rounds prints a stop line. mergeLedger is pure; commitLedger reads, merges and writes the file under a lock, so judge runs that overlap keep each other's items.

import fs from 'node:fs';
import { withFileLock } from './file-lock.mjs';
import { writeFileAtomic } from './atomic-write.mjs';

export const MARKS = ['fixed', 'partly', 'still', 'stale'];
const CLOSED = ['fixed', 'stale'];

const idNumber = (id) => Number(/^f(\d+)$/.exec(id || '')?.[1] || 0);

/** The items of a previous judge result; a result from before the ledger gives its fixes ids. */
export function previousItems(prev) {
  if (!prev) return [];
  if (Array.isArray(prev.items)) return prev.items;
  return (prev.fixes || []).map((f, i) => ({ id: `f${i + 1}`, axis: f.axis, ...(f.rule ? { rule: f.rule } : {}), at: f.at ?? null, fix: f.fix, status: 'new' }));
}

export const openItems = (items) => items.filter((i) => !CLOSED.includes(i.status));

const whatKey = (what) => String(what || '').toLowerCase().replace(/[^a-z0-9%.]+/g, ' ').trim();

/** Every item that names a value, grouped by its rule id (else by what it changes), oldest first: [{ what, items }]. */
export function targetHistory(items) {
  const groups = new Map();
  for (const i of items) {
    const key = i.rule || whatKey(i.what);
    if (!key || !i.want) continue;
    if (!groups.has(key)) groups.set(key, { what: i.rule ? `${i.rule}: ${i.what}` : i.what, items: [] });
    groups.get(key).items.push(i);
  }
  return [...groups.values()];
}

const numberIn = (v) => { const m = /-?\d+(\.\d+)?/.exec(String(v)); return m ? Number(m[0]) : null; };

/** True when three or more asked values for one target change direction (85, 40, 85) or return to an earlier value. */
export function movesBackAndForth(wants) {
  if (wants.length < 3) return false;
  const nums = wants.map(numberIn);
  if (nums.every((n) => n !== null)) {
    const steps = nums.slice(1).map((n, k) => Math.sign(n - nums[k])).filter(Boolean);
    return steps.some((d, k) => k > 0 && d !== steps[k - 1]);
  }
  const keys = wants.map(whatKey);
  return keys.some((v, k) => k > 1 && keys.slice(0, k - 1).includes(v) && keys[k - 1] !== v);
}

/** The prompt lines for the open items, or '' when there are none. */
export function ledgerPrompt(open, all = open) {
  if (!open.length) return '';
  const asked = targetHistory(all).map((g) => `- ${g.what}: ${g.items.map((i) => `${i.id} now ${i.now ?? '?'}, asked ${i.want}`).join('; ')}`);
  return `Ledger: the last judge of this film asked for these fixes.
${open.map((i) => `- ${i.id} (${i.axis}${i.rule ? `, rule ${i.rule}` : ''}${i.at != null ? ` at ${i.at}` : ''}): ${i.fix}`).join('\n')}
${asked.length ? `Values asked so far; measure the same target on the frames and reuse its words:\n${asked.join('\n')}\n` : ''}First mark each one: add "ledger":[{"id":"${open[0].id}","status":"fixed, partly, still or stale"}, ...] to the JSON. Mark "still" only if the sheet you see now shows that fault at the time named; mark "stale" when the element or the moment is no longer in this film. Then give fixes only for what is new; for an axis whose item is still open, write "fix":"${open[0].id}" (its id). A fix that undoes an item above needs "reverses":"<id>" and "why":"<one reason>".`;
}

function refersTo(fix, open) {
  const id = /^\s*(f\d+)\b/.exec(fix || '')?.[1];
  return open.find((i) => i.id === id) || null;
}

/**
 * The next ledger. `prev` is the previous items, `raw` the judge's JSON (its ledger marks, its fixes with
 * reverses and why), `fixes` the result's fixes. Returns { items, fixes, counts, reversals }: `fixes` with
 * id references replaced by the old item's text. `notes` are the judge's notes: each failing one with a rule
 * and no open item for that rule becomes a new item.
 */
export function mergeLedger(prev, raw, fixes, notes = []) {
  const marks = new Map((raw.ledger || []).map((m) => [m.id, m.status]));
  const counts = { fixed: 0, partly: 0, still: 0, stale: 0, unmarked: 0, new: 0 };
  const open = openItems(prev);
  const carried = prev.map((i) => {
    if (CLOSED.includes(i.status)) return i;
    const status = MARKS.includes(marks.get(i.id)) ? marks.get(i.id) : 'unmarked';
    counts[status] += 1;
    return { ...i, status };
  });
  let n = Math.max(0, ...prev.map((i) => idNumber(i.id)));
  const fresh = [];
  const shown = fixes.flatMap((f) => {
    const old = refersTo(f.fix, open);
    if (old && marks.get(old.id) === 'stale') return [];
    if (old) return [{ ...f, fix: `${old.id}: ${old.fix}` }];
    const given = (raw.fixes || []).find((x) => x.axis === f.axis) || {};
    const item = { id: `f${++n}`, axis: f.axis, ...(f.rule ? { rule: f.rule } : {}), at: f.at, fix: f.fix, status: 'new', ...(given.what ? { what: given.what, now: given.now ?? null, want: given.want ?? null } : {}) };
    if (given.reverses) Object.assign(item, { reverses: given.reverses, why: given.why || null });
    fresh.push(item);
    return [{ ...f, fix: `${item.id}: ${f.fix}` }];
  });
  for (const note of notes.filter((x) => x.verdict === 'fail' && x.rule)) {
    if ([...carried, ...fresh].some((i) => i.rule === note.rule && !CLOSED.includes(i.status))) continue;
    fresh.push({ id: `f${++n}`, axis: 'note', rule: note.rule, at: note.t, fix: note.note || 'no note given', status: 'new' });
  }
  counts.new = fresh.length;
  return { items: [...carried, ...fresh], fixes: shown, counts, reversals: fresh.filter((i) => i.reverses) };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/**
 * Merges this run into the ledger file as one step: the read, the merge and the write hold the lock, so a run that
 * finished meanwhile is read, not overwritten. Sets items, fixes and ledger on `result`, writes it, returns the merge.
 */
export async function commitLedger(file, raw, result) {
  return withFileLock(`${file}.lock`, () => {
    const led = mergeLedger(previousItems(readJson(file)), raw, result.fixes, result.notes);
    Object.assign(result, { fixes: led.fixes, items: led.items, ledger: ledgerLines(led) });
    writeFileAtomic(file, JSON.stringify(result, null, 1));
    return led;
  });
}

/** One stop line per target the judges moved back and forth over three or more rounds. */
export function flipFlopLines(items) {
  return targetHistory(items).filter((g) => movesBackAndForth(g.items.map((i) => i.want))).map((g) => {
    const last = g.items[g.items.length - 1];
    return `stop: keep ${g.what} at its current value${last.now ? ` (${last.now})` : ''}; the judge varies on this item (asked ${g.items.map((i) => i.want).join(', ')} over ${g.items.length} rounds)`;
  });
}

/** The compact line: "ledger: 3 fixed, 1 partly, 1 still; 2 new", one line per reversal, one per flip-flop. */
export function ledgerLines({ counts, reversals, items = [] }) {
  const unmarked = `${counts.stale ? `, ${counts.stale} stale` : ''}${counts.unmarked ? `, ${counts.unmarked} unmarked` : ''}`;
  return [
    `ledger: ${counts.fixed} fixed, ${counts.partly} partly, ${counts.still} still${unmarked}; ${counts.new} new`,
    ...reversals.map((r) => `reverses ${r.reverses}: ${r.why || 'no reason given; treat the old fix as standing'}`),
    ...flipFlopLines(items),
  ];
}
