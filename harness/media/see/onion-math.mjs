// Pure parts of `vawe frame --moment <s> --onion`: which frames, how much each one weighs, how each one is tinted, and the ffmpeg graph that blends them.
// No I/O and no heavy imports: harness/cli/verbs.mjs loads this file to check the arguments.

export const ONION_SPAN = 0.3;
export const ONION_FRAMES = 5;
const LEGEND_H = 68;
const COOL = [0.15, 0.5, 1];
const WARM = [1, 0.4, 0.08];
const MAX_TINT = 0.9;

const round = (n) => +n.toFixed(3);

/** The first problem in the arguments of onion, or null. Pure. */
export function onionProblem({ at, span, n }) {
  if (at === undefined) return 'missing --at <s> (the moment to look at)';
  if (!(Number.isFinite(Number(at)) && Number(at) >= 0)) return `--at is not a number of seconds: "${at}"`;
  if (!(span > 0)) return '--span must be more than 0 seconds';
  if (!(Number.isInteger(n) && n >= 2 && n <= 12)) return '-n must be a whole number from 2 to 12';
  return null;
}

/** The `n` times across [from, to], oldest first, the last one at `to`. Pure. */
export const onionTimes = (from, to, n) => Array.from({ length: n }, (_, i) => round(from + ((to - from) * i) / (n - 1)));

/** The blend weight of each of `n` frames, oldest first: they sum to 1 and rise with age, so the newest is the strongest and the oldest the faintest. Pure. */
export function blendWeights(n) {
  const raw = Array.from({ length: n }, (_, i) => 0.4 + 0.6 * (i / (n - 1)) ** 2);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

/** The tint of frame `i` of `n`: `color` runs cool to warm with the frame's age, and `strength` (0 for the newest, which keeps its own colours) is how far the frame moves to that colour. Pure. */
export function frameTint(i, n) {
  const u = i / (n - 1);
  const color = COOL.map((c, k) => c + (WARM[k] - c) * u);
  return { color, strength: MAX_TINT * (1 - u) };
}

/** The colorchannelmixer arguments that keep (1 - strength) of a frame and replace the rest by its grey in the tint colour. Pure. */
export function tintMixer({ color, strength }) {
  const luma = [0.299, 0.587, 0.114];
  const rows = ['r', 'g', 'b'];
  const parts = [];
  for (const [ri, row] of rows.entries()) {
    for (const [ci, col] of rows.entries()) {
      const v = strength * color[ri] * luma[ci] + (ri === ci ? 1 - strength : 0);
      parts.push(`${row}${col}=${v.toFixed(4)}`);
    }
  }
  return parts.join(':');
}

const hex = (color) => `0x${color.map((c) => Math.round(Math.min(1, c) * 255).toString(16).padStart(2, '0')).join('')}`;

/** True when the mean grey (0 to 255) of a frame says its ground is light: ghosts are then the dark ink, not the bright one. Pure. */
export const isLightGround = (grey) => grey > 127;

/** The ffmpeg filter_complex for `times.length` inputs of width x height: tint each (on a light ground in the negative, so white stays white), blend with the weights, add a legend bar with a swatch and a time per frame. Pure. */
export function onionGraph(times, width, height, lightBackground) {
  const n = times.length;
  const weights = blendWeights(n);
  const flip = lightBackground ? ',negate' : '';
  const tinted = times.map((_, i) => `[${i}:v]format=gbrp${flip},colorchannelmixer=${tintMixer(frameTint(i, n))}${flip}[c${i}]`);
  const blend = `${times.map((_, i) => `[c${i}]`).join('')}mix=inputs=${n}:weights='${weights.map((w) => w.toFixed(4)).join(' ')}',format=rgb24,pad=${width}:${height + LEGEND_H}:0:0:color=0x15171c[m]`;
  const fontsize = Math.max(14, Math.round(width / 80));
  const cell = (width - 32) / n;
  const marks = times.flatMap((t, i) => {
    const x = Math.round(16 + i * cell);
    const { color, strength } = frameTint(i, n);
    const swatch = strength === 0 ? [1, 1, 1] : color;
    return [
      `drawbox=x=${x}:y=${height + 14}:w=${fontsize}:h=${fontsize}:color=${hex(swatch)}:t=fill`,
      `drawtext=text='${t.toFixed(2)}s':x=${x + fontsize + 6}:y=${height + 14}:fontsize=${fontsize}:fontcolor=white`,
    ];
  });
  const note = `drawtext=text='ghosts run from the oldest (cool and faint) to the newest (strong and in its own colours)':x=16:y=${height + 42}:fontsize=${fontsize}:fontcolor=0xaab0bc`;
  return [...tinted, blend, `[m]${[...marks, note].join(',')}[out]`].join(';');
}
