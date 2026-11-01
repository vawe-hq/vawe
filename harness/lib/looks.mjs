// The pure parts of `vawe frame --looks`: which looks and which seconds a call asks for. No I/O.
import { LOOKS } from '../../core/surfaces/lens.js';
import { parseAt } from '../media/compare-frames.mjs';

export const AS_IS = 'as-is';

/** The look names of an --only list ("a,b"), or all of them; throws naming the valid ones. */
export function looksOf(only) {
  if (only === undefined) return Object.keys(LOOKS);
  const names = String(only).split(',').map((s) => s.trim()).filter(Boolean);
  const bad = names.filter((n) => !(n in LOOKS));
  if (!names.length || bad.length) throw new Error(`--only ${bad.length ? `has no look "${bad.join('", "')}"` : 'is empty'}; valid: ${Object.keys(LOOKS).join(', ')}`);
  return names;
}

/** The first problem in the arguments of looks, or null. */
export function looksProblem({ at, only }) {
  try { parseAt(at); looksOf(only); } catch (e) { return e.message; }
  return null;
}
