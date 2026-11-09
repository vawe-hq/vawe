import { RULES } from '../../live/verb-hint.mjs';
import { brief } from './redact.mjs';
import { verbNow } from '../../cli/aliases.mjs';

const HINT_WINDOW_CALLS = 5;

const RUN_START_SLACK_MS = 5000;

function takeRun(runs, verb, from, until) {
  const at = runs.findIndex((r) => verbNow(r.verb) === verbNow(verb) && Date.parse(r.start) >= from - RUN_START_SLACK_MS && Date.parse(r.start) < until);
  return at >= 0 ? runs.splice(at, 1)[0] : null;
}

const nextCallMs = (calls, call, verb) => calls.find((c) => c.index > call.index && c.verbs.some((v) => verbNow(v.verb) === verbNow(verb) && !v.help))?.ms ?? Infinity;

/** Every vawe verb the agent ran, in order: { verb, args, call, sec, ok, reason, secs, slotWaitS }; secs comes from the run log record joined by verb and start time, else the result footer; ok is null when neither exists. Pure. */
export function verbEvents(calls, startMs, runLog = []) {
  const runs = [...runLog].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const events = [];
  for (const call of calls) {
    const footers = [...(call.footers ?? [])];
    for (const { verb, args, help } of call.verbs) {
      const at = footers.findIndex((f) => verbNow(f.verb) === verbNow(verb));
      const footer = at >= 0 ? footers.splice(at, 1)[0] : null;
      const run = help ? null : takeRun(runs, verb, call.ms, nextCallMs(calls, call, verb));
      const ok = run ? run.exitCode === 0 : footer ? footer.ok : null;
      events.push({ verb, help, refused: call.flags?.noApproval === true, args: brief(args, 80), call: call.index, sec: Math.round((call.ms - startMs) / 1000), ok, reason: footer?.reason ?? run?.error ?? null, secs: run?.durationS ?? footer?.secs ?? null, slotWaitS: run?.slotWaitS ?? null, fromRunLog: run !== null, callSecs: Math.max(0, Math.round((call.resultMs - call.ms) / 1000) || 0) });
    }
  }
  return events;
}

const outcomeOf = (named, printer, after) => (!after ? 'none'
  : named.map(verbNow).includes(verbNow(after.verb)) ? 'followed'
    : verbNow(after.verb) === verbNow(printer.verb) ? 'repeated' : 'ignored');

/** How the agent treated each `next:` line a verb printed: followed (its next verb call is a named one), repeated (the same verb again, as in a fix loop), ignored (another verb) or none (no verb call after); with the lines after it and the size of the result it sat in. Pure. */
export function nextLineOutcomes(calls, allEvents) {
  const events = allEvents.filter((e) => !e.help);
  const out = [];
  for (const call of calls) {
    const mine = events.filter((e) => e.call === call.index);
    if (!mine.length) continue;
    const printer = mine.at(-1);
    const after = events[events.indexOf(printer) + 1];
    for (const [i, named] of (call.next ?? []).entries()) {
      if (!named.length) continue;
      out.push({ verb: printer.verb, named, then: after?.verb ?? null, outcome: outcomeOf(named, printer, after), linesAfter: call.nextAt?.[i] ?? null, chars: call.chars ?? 0 });
    }
  }
  return out;
}

const hintId = (text) => RULES.find((r) => text.includes(r.say) || r.legacy?.test(text))?.id ?? null;

/** Each hook-injected hint that names a verb, and whether a verb call it names came within the next calls. Pure. */
export function hintOutcomes(hints, allEvents) {
  const events = allEvents.filter((e) => !e.help);
  return hints.filter((h) => h.named.length).map((h) => {
    const near = events.filter((e) => e.call > h.afterCall && e.call <= h.afterCall + HINT_WINDOW_CALLS);
    const text = h.text;
    return { source: h.source, id: hintId(text), named: h.named, outcome: near.some((e) => h.named.map(verbNow).includes(verbNow(e.verb))) ? 'followed' : 'ignored', text: brief(text, 120) };
  });
}
