// The pure half of the template export (harness/media/template-export.mjs): what the page's template.json asks for, how the page
// splits into layers, when each layer shows, and the keyframes of each editable text. The page reads live in template-sample.mjs.
import fs from 'node:fs';
import path from 'node:path';

export class TemplateError extends Error {}

const ID = /^[a-z][a-z0-9-]*$/;

/**
 * The inputs of `films/<name>/template.json`: { inputs: [{ id, selector, label?, at? }] }. `at` is the key frame in seconds, where
 * the text's font, size and colour are read. No file: no inputs. A bad file throws one TemplateError line that names the fix.
 */
export function readTemplate(pagePath) {
  const file = path.join(path.dirname(path.resolve(pagePath)), 'template.json');
  if (!fs.existsSync(file)) return { file: null, inputs: [] };
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new TemplateError(`${file}: not JSON (${e.message})`); }
  return { file, inputs: checkInputs(raw, file) };
}

/** The inputs of a parsed template.json, checked. Pure. */
export function checkInputs(raw, where = 'template.json') {
  if (!raw || !Array.isArray(raw.inputs)) throw new TemplateError(`${where}: needs { "inputs": [{ "id": "headline", "selector": "h1" }] }`);
  const seen = new Set();
  return raw.inputs.map((input, i) => {
    const at = `${where}: inputs[${i}]`;
    if (!ID.test(input?.id ?? '')) throw new TemplateError(`${at}: id must be lowercase letters, digits and dashes, starting with a letter (got ${JSON.stringify(input?.id)})`);
    if (seen.has(input.id)) throw new TemplateError(`${at}: id "${input.id}" is used twice`);
    seen.add(input.id);
    if (typeof input.selector !== 'string' || !input.selector.trim()) throw new TemplateError(`${at}: selector must be a CSS selector string`);
    if (input.at !== undefined && !(Number.isFinite(input.at) && input.at >= 0)) throw new TemplateError(`${at}: at must be seconds, 0 or more`);
    return { id: input.id, selector: input.selector, label: input.label || input.id, at: input.at ?? null };
  });
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layer';

/** [first, end) frame of the frames where `shown` is true, or null. Pure. */
export function shownSpan(shown) {
  const first = shown.indexOf(true);
  return first < 0 ? null : [first, shown.lastIndexOf(true) + 1];
}

const unionSpan = (spans) => {
  const real = spans.filter(Boolean);
  return real.length ? [Math.min(...real.map((s) => s[0])), Math.max(...real.map((s) => s[1]))] : null;
};

// A world, an element that holds an editable text, and an element that blends with what is under it each get a layer of their own:
// a world is a beat the editor trims, a text needs its live copy right above it, a blend mode must be set on its own layer.
const ownsLayer = (child, hosts) => Boolean(child.world) || hosts.has(child.nth) || child.blends.some((b) => b !== 'normal');

function layerOf(members) {
  const [first] = members;
  const blends = [...new Set(members.flatMap((m) => m.blends))];
  const name = first.world ? `world-${slug(first.world)}` : members.length === 1 ? slug(first.label) : `${slug(first.label)}-to-${slug(members.at(-1).label)}`;
  return {
    name, world: first.world ?? null, members: members.map((m) => m.nth),
    blend: blends.length === 1 ? blends[0] : 'normal', blendVaries: blends.length > 1,
    span: unionSpan(members.map((m) => shownSpan(m.shown))),
  };
}

/**
 * The layers of a page, bottom first. `children`: the body's elements in paint order, [{ nth, label, world, blends, shown }]
 * (blends: every mix-blend-mode seen; shown: one bool per frame). `hosts`: the nth of each child that holds an input. Neighbours that
 * need no layer of their own share one. A child that never shows gets none and is listed in `skipped`. Pure.
 */
export function planLayers(children, hosts = new Set()) {
  const layers = [];
  const skipped = [];
  let run = null;
  for (const child of children) {
    if (!shownSpan(child.shown)) { skipped.push(child.label); continue; }
    if (ownsLayer(child, hosts)) { layers.push([child]); run = null; continue; }
    if (run) run.push(child); else { run = [child]; layers.push(run); }
  }
  const named = layers.map(layerOf);
  return { layers: named.map((l, i) => ({ ...l, name: `${String(i + 1).padStart(2, '0')}-${l.name}` })), skipped };
}

const close = (a, b, eps) => (Array.isArray(a) ? a.every((v, i) => Math.abs(v - b[i]) <= eps) : Math.abs(a - b) <= eps);
const midpoint = (a, b) => (Array.isArray(a) ? a.map((v, i) => (v + b[i]) / 2) : (a + b) / 2);

/**
 * The keyframes that redraw `values` (one per frame from `firstFrame`, numbers or arrays) under linear interpolation: a key is left out
 * when it lies on the line between its two neighbours, within `eps`. Returns [{ frame, value }]. Pure.
 */
export function keyframes(values, firstFrame = 0, eps = 0.01) {
  return values.flatMap((value, i) => {
    if (i > 0 && i < values.length - 1 && close(value, midpoint(values[i - 1], values[i + 1]), eps)) return [];
    return [{ frame: firstFrame + i, value }];
  });
}

/** The frame an input's style is read at: its own `at`, else the first frame of its highest opacity. Pure. */
export function keyFrameOf(input, samples, fps) {
  if (input.at != null) return Math.min(samples.length - 1, Math.round(input.at * fps));
  const peak = Math.max(...samples.map((s) => s.opacity));
  return Math.max(0, samples.findIndex((s) => s.opacity === peak));
}

/** [{ from, to }] in seconds of the runs of frames where `flag(sample)` holds. Pure. */
export function runsOf(samples, flag, fps) {
  const runs = [];
  samples.forEach((s, i) => {
    if (!flag(s)) return;
    const last = runs.at(-1);
    if (last && last.end === i) last.end = i + 1; else runs.push({ start: i, end: i + 1 });
  });
  return runs.map((r) => ({ from: +(r.start / fps).toFixed(3), to: +(r.end / fps).toFixed(3) }));
}

/**
 * The samples with opacity 0 on every frame where the film paints none of the text (`painted`: one bool per frame of its reference
 * clip, which starts at frame `start`). A clip-path, a mask or a covering shape hides text that CSS still calls opaque. Pure.
 */
export function paintedSamples(samples, painted, start) {
  return samples.map((s, i) => (i < start || i >= start + painted.length || painted[i - start] ? s : { ...s, opacity: 0 }));
}

/** Seconds to the nearest whole frame at `fps`. Pure. */
export const toFrame = (seconds, fps) => Math.round(seconds * fps);

const baseName = (file) => path.basename(file);

/**
 * The sound clips, in frames: the whole mix first, turned off, then each cue at its second, cut at the film's end. `stems`:
 * page-audio.mjs writeStems. Pure.
 */
export function soundClips(stems, frames, fps) {
  if (!stems.mix) return [];
  const cues = stems.cues.map((c) => {
    const start = toFrame(c.at, fps);
    return { name: baseName(c.file).replace(/\.wav$/, ''), file: baseName(c.file), start, end: Math.min(frames, start + Math.max(1, toFrame(c.seconds, fps))), enabled: true };
  }).filter((c) => c.start < frames);
  return [{ name: 'mix (the whole sound track)', file: baseName(stems.mix), start: 0, end: frames, enabled: false }, ...cues];
}

/** One timeline marker per world that shows, in frames (`spans`: world-sample.mjs sampleWorlds). Pure. */
export const worldMarkers = (spans, fps) => spans.filter((s) => s.start != null).map((s) => ({
  name: s.id, comment: `scene ${s.id}: ${s.start.toFixed(2)} to ${s.end.toFixed(2)} s`, start: toFrame(s.start, fps), end: toFrame(s.end, fps),
}));

const round = (v, d = 2) => +v.toFixed(d);

/**
 * The editable text of one input: its span, its style at the key frame, and keyframes for position, scale, opacity and colour.
 * `samples`: one per frame, { opacity, x, baseline, scale, color, effects } (template-sample.mjs readFrame). Pure.
 */
export function textTrack(input, samples, style, fps) {
  const span = shownSpan(samples.map((s) => s.opacity > 0.001));
  if (!span) return { ...input, span: null };
  const inside = samples.slice(span[0], span[1]);
  return {
    ...input, span, style, keyFrame: keyFrameOf(input, samples, fps),
    position: keyframes(inside.map((s) => [round(s.x), round(s.baseline)]), span[0], 0.05),
    scale: keyframes(inside.map((s) => round(s.scale * 100, 3)), span[0], 0.05),
    opacity: keyframes(inside.map((s) => round(s.opacity * 100, 2)), span[0], 0.05),
    color: keyframes(inside.map((s) => s.color.map((c) => round(c, 4))), span[0], 0.002),
    effects: runsOf(samples, (s) => s.opacity > 0.001 && s.effects, fps),
  };
}
