// Which taste topics a beat (one data-world element) calls for, read from what the beat holds. Pure over html; it steers, it never refuses.
const OPEN = /<([a-z][a-z0-9-]*)\b[^>]*\bdata-world\s*=\s*["']([^"']*)["'][^>]*>/gi;
const TAG = /<(\/?)([a-z][a-z0-9-]*)\b[^>]*?(\/?)>/gi;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** { id: html } of each data-world element, from its open tag to its matching close tag. */
export function beatsOf(html) {
  const beats = {};
  for (const open of html.matchAll(OPEN)) {
    const tag = open[1].toLowerCase();
    let depth = 1;
    let end = html.length;
    TAG.lastIndex = open.index + open[0].length;
    for (let m = TAG.exec(html); m; m = TAG.exec(html)) {
      if (m[2].toLowerCase() !== tag || m[3]) continue;
      depth += m[1] ? -1 : 1;
      if (depth === 0) { end = m.index + m[0].length; break; }
    }
    beats[open[2]] ??= html.slice(open.index, end);
  }
  return beats;
}

/** The ids of the beats in `after` that are new or hold different html than in `before` ('' for no earlier page). */
export function changedWorlds(before, after) {
  const was = beatsOf(before);
  return Object.entries(beatsOf(after)).filter(([id, h]) => was[id] !== h).map(([id]) => id);
}

const strip = (h) => h.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const TEXT = /<(h[1-6]|p|blockquote|figcaption|li)\b/i;
const UI = /<(button|input|table|nav|form|textarea)\b|\bdata-(?:ui|component)\b|class\s*=\s*["'][^"']*\b(?:ui|panel|card|window|terminal|chat|dashboard|sidebar|toolbar|browser)\b/i;
const GROUND = /<(canvas|video)\b|background(?:-image)?\s*:|\b(?:linear|radial|conic)-gradient\(|<svg\b/i;
const SOUND = /<audio\b/i;

// The css rules that name the beat's id in a selector, so a ground set in a stylesheet counts too.
function ruleText(html, id) {
  const sel = new RegExp(`[^{}]*data-world\\s*=\\s*["']?${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?[^{}]*\\{[^}]*\\}`, 'g');
  return (html.match(sel) ?? []).join('\n');
}

/**
 * { id: [topics] } for each beat in `worlds` (default: all), topics among type, colour, motion, cuts, sound, layout:
 * type for a heading or text, layout for a product UI, colour for a ground, cuts for a beat after the first, sound for an audio tag.
 */
export function beatTopics(html, worlds = null) {
  const beats = beatsOf(html);
  const ids = Object.keys(beats);
  const out = {};
  for (const id of worlds ?? ids) {
    const beat = beats[id];
    if (beat === undefined) continue;
    const own = `${beat}\n${ruleText(html, id)}`;
    const topics = [];
    if (TEXT.test(beat) || strip(beat).length > 0) topics.push('type', 'motion');
    if (UI.test(own)) topics.push('layout');
    if (GROUND.test(own)) topics.push('colour');
    if (ids.indexOf(id) > 0) topics.push('cuts');
    if (SOUND.test(beat)) topics.push('sound');
    out[id] = topics;
  }
  return out;
}

/** The page outside every data-world element: a lockup or a caption that stays across beats. */
const outsideOf = (html) => Object.values(beatsOf(html)).reduce((rest, beat) => rest.replace(beat, ' '), html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' '));

/** The topics of a write: those of each beat it changed, and type and motion (plus layout, colour) for changed content outside every beat. */
export function changedTopics(before, after) {
  const topics = Object.values(beatTopics(after, changedWorlds(before, after))).flat();
  const outside = outsideOf(after);
  if (strip(outside) && outside !== outsideOf(before)) {
    topics.push('type', 'motion');
    if (UI.test(outside)) topics.push('layout');
    if (GROUND.test(outside)) topics.push('colour');
  }
  return [...new Set(topics)];
}
