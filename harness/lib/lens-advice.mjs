// The lens lines of a draft: the texel ratio at the focus, the tilt per world, the backdrop and shadow. Pure: the samples of
// lens.measure(t) (core/surfaces/lens.js) in, short lines out. Advice only.
import { CLAMP_DEG, READ_DEG, cueRead } from '../../core/surfaces/lens-views.js';

export const TEXEL_MAX = 1.05;
const POSES_SHOWN = 8;
const f1 = (n) => n.toFixed(1);

/** The advice line for the sample where a texture is drawn the most above its pixels, or null when none is over TEXEL_MAX. */
export function texelLine(samples) {
  const worst = samples.filter((s) => s.texel != null).sort((a, b) => b.texel - a.texel)[0];
  if (!worst || worst.texel <= TEXEL_MAX) return null;
  return `lens texel: the focused region is drawn ${worst.texel.toFixed(2)}x its source pixels at ${f1(worst.t)} s, so text reads soft; fix: a sharper source (a page capture: bin/vawe new --from-url <url> --tour steps.json --scale 2), or a smaller zoom there`;
}

const worldAt = (worlds, t) => worlds?.find((w) => w.start != null && t >= w.start && t < w.end)?.id ?? `${f1(t)}s`;

/** One line: the tilt in degrees (x/y) at each sample, named by world when the page has worlds, against the readable range and CLAMP_DEG. Null for no samples. */
export function poseLine(samples, worlds = null) {
  if (!samples.length) return null;
  const step = Math.max(1, Math.ceil(samples.length / POSES_SHOWN));
  const shown = samples.filter((_, i) => i % step === 0).map((s) => {
    const over = Math.max(Math.abs(s.pose.x), Math.abs(s.pose.y));
    return `${worldAt(worlds, s.t)} ${Math.round(s.pose.x)}/${Math.round(s.pose.y)}${over > CLAMP_DEG ? ' OVER' : over > READ_DEG ? '!' : ''}`;
  });
  return `lens tilt x/y deg: ${shown.join(', ')} (readable up to ${READ_DEG}, clamp ${CLAMP_DEG}; ! is over readable)`;
}

/** One line: the page edge against the backdrop and whether the shadow reads, at the last sample that sees the page edge. Null when none does. */
export function backdropLine(samples) {
  const seen = samples.filter((s) => s.edge && s.backdrop).at(-1);
  if (!seen) return null;
  const cue = cueRead(seen.backdrop, seen.edge);
  const verdict = cue.visible ? 'shadow reads' : `shadow invisible${cue.mode === 'dark' ? ` (the rim light ${cue.rim.toFixed(1)}:1 carries the edge)` : ''}: compare 3 backdrops in one sheet`;
  return `lens backdrop at ${f1(seen.t)} s: page edge ${cue.edge.toFixed(1)}:1 against it, shadow ${cue.shadow.toFixed(2)}:1, ${verdict}`;
}

/** The lens lines of a whole draft, [] for a page with no lens. */
export const lensLines = (samples, worlds) => (samples?.length ? [texelLine(samples), poseLine(samples, worlds), backdropLine(samples)].filter(Boolean) : []);
