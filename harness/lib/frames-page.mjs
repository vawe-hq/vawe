// `vawe frame --world all`: the pure parts. The sheet layout is harness/lib/artboard.mjs; harness/media/frames.mjs renders the stills.

import { PLACEHOLDER, STARTER_LINE } from './measured-brief.mjs';

/** { page, full, zoom, worlds } from the argv after the script name; --world takes ids, comma-separated or repeated. Throws an Error naming the flag. Pure. */
export function parseFramesArgs(argv) {
  const out = { page: null, full: false, zoom: false, worlds: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--full') out.full = true;
    else if (a === '--zoom') out.zoom = true;
    else if (a === '--world') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error('--world needs a world id, for example --world s3 or --world s1,s3');
      out.worlds.push(...v.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (a.startsWith('--')) throw new Error(`unknown flag ${a}; valid: --full --zoom --world <id>`);
    else if (out.page === null) out.page = a;
    else throw new Error(`unexpected argument ${a}; one page only`);
  }
  return out;
}

/** The spans of the wanted ids, in page order; every span when `ids` is empty. Throws an Error that lists the page's worlds when an id is unknown. Pure. */
export function selectWorlds(spans, ids) {
  const unknown = ids.filter((id) => !spans.some((s) => s.id === id));
  if (unknown.length) throw new Error(`--world ${unknown.join(',')}: no such world; this page has ${spans.map((s) => s.id).join(' ')}`);
  return ids.length ? spans.filter((s) => ids.includes(s.id)) : spans;
}

/**
 * The printed lines for all worlds: each fired rule once, led by every world it fired in, and one line for the
 * clean worlds. `shots` are [{ id, fired }] with fired from firedRules; `format` is firedLines. Pure.
 */
export function worldLines(shots, format, { starter = false } = {}) {
  const byRule = new Map();
  for (const s of shots) for (const f of s.fired) {
    if (!byRule.has(f.id)) byRule.set(f.id, { first: f, worlds: [] });
    byRule.get(f.id).worlds.push(s.id);
  }
  const lines = [...byRule.values()].map(({ first, worlds }) => `  ${worlds.join(', ')}: ${format([first], 1)[0].trim()}`);
  const clean = shots.filter((s) => !s.fired.length).map((s) => s.id);
  if (!clean.length) return lines;
  return [...lines, starter ? `  starter page: ${clean.join(', ')} hold the starter's grey and words, so no rule has a film to read; the film is not written yet` : `  clean: ${clean.join(', ')}`];
}

/** True while the page is still the one `vawe new` wrote: its grey ground placeholder and its line under the headline are both unchanged. Pure. */
export const isStarterPage = (html) => html.includes(`--ground: ${PLACEHOLDER.ground}`) && html.includes(`>${STARTER_LINE}<`);
