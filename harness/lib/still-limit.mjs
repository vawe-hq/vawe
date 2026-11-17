// No part of the frame moving by itself for longer than STILL_SEC outside a declared hold. The still runs come from
// scene-stats staticRuns plus the seconds where only a whole-frame move runs (harness/lib/camera-moves.mjs). A hold is declared per check
// (AGENTS.md "Waivers"): "static-window@2.1-3.4" for a still run, "tile-run@a-b" and "tail-tiles@a-b" for the judge's sheet, "world-held@a-b" for a world.
import LIMITS from '../../taste/build/limits.json' with { type: 'json' };
import { splitWaiver, entryHasReason, waiverHint } from './waivers.mjs';

export const STILL_SEC = LIMITS['live-hold'].still_limit_s;

/** The [a, b] second ranges the page declares as holds for check `code`, each with its _why. */
export function declaredHolds(authoring = {}, code = 'static-window') {
  const { allow = [] } = authoring;
  const holds = [];
  for (const entry of allow) {
    const { code: entryCode, instance } = splitWaiver(entry);
    if (entryCode !== code || !entryHasReason(authoring, entry)) continue;
    const m = instance === null ? ['', '0', 'Infinity'] : instance.match(/^([\d.]+)-([\d.]+)$/);
    if (m) holds.push([Number(m[1]), Number(m[2])]);
  }
  return holds;
}

const outside = (r, holds) => r.len - holds.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, r.b) - Math.max(a, r.a)), 0);

/** Still runs ({ a, b, len } s) whose time outside every declared hold and read hold (worlds.mjs readHolds) is over `limit`. Pure. */
export function undeclaredStills(runs, authoring = {}, limit = STILL_SEC, readHolds = []) {
  const holds = [...declaredHolds(authoring, 'static-window'), ...readHolds];
  return runs.filter((r) => outside(r, holds) > limit + 1e-9);
}

/** The problem line for one still run, with the two fixes. Pure. */
export function stillText(r, limit = STILL_SEC) {
  const why = r.camera ? 'only the camera moves' : 'nothing moves';
  return `${stillMeasured(r, limit)}: ${why}; ${stillFix(r)}`;
}

const stillMeasured = (r, limit) => `static window ${r.a}-${r.b} s (${r.len} s, limit ${limit} s)`;
const OPENING_S = 0.3;
const LIVE = 'glint(el, { at, dur }) or breathe(el, { at, dur }) from core/motion/alive.js, a counter or typing';
const stillFix = (r) => `${r.a < OPENING_S ? 'start the first entrance at 0 to 0.3 s (rule first-frame), or ' : ''}give the hold an element motion (${LIVE}), not a camera drift; ${waiverHint(`static-window@${r.a}-${r.b}`)}`;

/** The { kind, at, measured, fix } of one still run (the same run stillText words). Pure. */
export const stillItem = (r, limit = STILL_SEC) => ({ kind: 'static-window', at: r.a, measured: stillMeasured(r, limit), fix: stillFix(r) });

const round2 = (x) => +x.toFixed(2);

/** The still runs without the `typing` seconds (harness/lib/typing-spans.mjs): text that changes is element motion the pixels cannot see. Pure. */
export function withoutTypingStills(runs, typing = []) {
  return runs.flatMap((r) => {
    const parts = typing.reduce((acc, [c, d]) => acc.flatMap(([p, q]) => (d <= p || c >= q ? [[p, q]] : [[p, Math.min(q, c)], [Math.max(p, d), q]].filter(([x, y]) => y > x))), [[r.a, r.b]]);
    return parts.map(([a, b]) => ({ ...r, a: round2(a), b: round2(b), len: round2(b - a) }));
  });
}

/** A predicate for { a, b } second ranges that lie inside one hold declared for check `code`. */
export function insideHold(authoring = {}, code = 'static-window') {
  const holds = declaredHolds(authoring, code);
  return (r) => holds.some(([a, b]) => a <= r.a + 1e-9 && r.b <= b + 1e-9);
}
