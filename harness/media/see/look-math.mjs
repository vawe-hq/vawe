// Pure parts of `vawe see`: flashes, clipped pixels, bloom spread, chromatic offset and glow colour, the table and the advice. No I/O.

const FLASH_JUMP = 25;
export const FLASH_HALF_WINDOW = 15;
const CLIP_LEVEL = 250;
const FLASH_TAIL = 0.25;
const EDGE_BRIGHT = 200;
const EDGE_DROP = 3;
const EDGE_CONTRAST = 100;
const FLOOR_WINDOW = 48;
const GLOW_FROM = 3;
const GLOW_TO = 14;
const GLOW_MIN = 3;
const CHROMA_STEP = 120;
const CHROMA_WINDOW = 6;
const CHROMA_CONTRAST = 80;
const MIN_EDGES = 20;

export const median = (list) => {
  if (!list.length) return NaN;
  const s = Float64Array.from(list).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;

/** The gaussian sigma (px) of a glow behind a sharp edge from its 90 to 10 % spread: the glow is half of full white at the edge, so the spread runs to 1.28 sigma. */
export const bloomSigma = (spreadPx) => r1(spreadPx / 1.28);

export function lookProblem({ from, to }) {
  if (from !== undefined && !(Number.isFinite(Number(from)) && Number(from) >= 0)) return `--from is not a number of seconds: "${from}"`;
  if (to !== undefined && !(Number.isFinite(Number(to)) && Number(to) > 0)) return `--to is not a number of seconds: "${to}"`;
  if (from !== undefined && to !== undefined && Number(to) <= Number(from)) return '--to must be after --from';
  return null;
}

/** The flashes in a series of per-frame mean luma: runs where the mean sits more than `jump` above the running median. Each is { frame, at, frames, peak, base, rise, decay } with the length counted where the mean is above a quarter of the excess. */
export function flashProfile(means, fps, jump = FLASH_JUMP, half = FLASH_HALF_WINDOW) {
  const base = means.map((_, i) => median(means.slice(Math.max(0, i - half), i + half + 1)));
  const out = [];
  let i = 0;
  while (i < means.length) {
    if (means[i] - base[i] <= jump) { i++; continue; }
    let end = i;
    while (end + 1 < means.length && means[end + 1] - base[end + 1] > jump) end++;
    let peak = i;
    for (let k = i; k <= end; k++) if (means[k] > means[peak]) peak = k;
    const floor = base[peak] + FLASH_TAIL * (means[peak] - base[peak]);
    let left = peak, right = peak;
    while (left > 0 && means[left - 1] > floor) left--;
    while (right < means.length - 1 && means[right + 1] > floor) right++;
    out.push({ frame: left, at: r2(left / fps), frames: right - left + 1, peak: Math.round(means[peak]), base: Math.round(base[peak]), rise: peak - left + 1, decay: right - peak + 1 });
    i = right + 1;
  }
  return out;
}

/** The share (0 to 100) of pixels at or above `level` in a luma plane. */
export function clippedShare(luma, level = CLIP_LEVEL) {
  let n = 0;
  for (let i = 0; i < luma.length; i++) if (luma[i] >= level) n++;
  return (100 * n) / luma.length;
}

function crossing(v, level, from, to) {
  if (v(from) < level) return from;
  for (let i = from; i < to; i++) {
    if (v(i) >= level && v(i + 1) < level) return i + (v(i) - level) / (v(i) - v(i + 1));
  }
  return null;
}

/** Bloom spreads and halo colour along one line of a frame (`base` index of the first pixel, `step` between pixels, `n` pixels): the distance in px over which luma falls from 90% to 10% into the dark side of each bright edge. */
function bloomOnLine(P, base, step, n, out) {
  const L = (i) => P.L[base + i * step];
  const C = (i, c) => P.rgb[(base + i * step) * 3 + c];
  for (let x = 3; x < n - FLOOR_WINDOW - 1; x++) {
    const top = L(x);
    if (top < EDGE_BRIGHT || L(x + 1) > top - EDGE_DROP) continue;
    const plateau = Math.max(top, L(x - 1), L(x - 2), L(x - 3));
    let floor = 255, at = 1;
    for (let k = 1; k <= FLOOR_WINDOW; k++) if (L(x + k) < floor) { floor = L(x + k); at = k; }
    if (plateau - floor < EDGE_CONTRAST || floor > 0.5 * plateau) continue;
    const d90 = crossing((i) => L(x + i), floor + 0.9 * (plateau - floor), 0, at);
    const d10 = crossing((i) => L(x + i), floor + 0.1 * (plateau - floor), 0, at);
    if (d90 === null || d10 === null) continue;
    out.spreads.push(d10 - d90);
    const glow = [0, 0, 0];
    let seen = 0;
    for (let k = Math.ceil(d90) + GLOW_FROM; k <= Math.min(Math.ceil(d90) + GLOW_TO, at); k++) {
      if (L(x + k) - floor < GLOW_MIN) continue;
      for (let c = 0; c < 3; c++) glow[c] += C(x + k, c) - C(x + at, c);
      seen++;
    }
    if (seen) out.halo.push(glow.map((g) => g / seen));
    x += at;
  }
}

/** The signed offsets (px, blue minus red) of high-contrast edges along one line, appended to `out`. */
function chromaOnLine(P, base, step, n, out) {
  const L = (i) => P.L[base + i * step];
  const ch = (c) => (i) => P.rgb[(base + i * step) * 3 + c];
  const R = ch(0), B = ch(2);
  const w = CHROMA_WINDOW;
  for (let x = w + 3; x < n - w - 3; x++) {
    if (Math.abs(L(x + 3) - L(x - 3)) < CHROMA_STEP) continue;
    let c = x;
    for (let k = x; k <= x + 6 && k < n - w - 3; k++) if (Math.abs(L(k + 3) - L(k - 3)) > Math.abs(L(c + 3) - L(c - 3))) c = k;
    const dr = R(c + w) - R(c - w), db = B(c + w) - B(c - w);
    x = c + 2 * w;
    if (Math.abs(dr) < CHROMA_CONTRAST || Math.abs(db) < CHROMA_CONTRAST || Math.sign(dr) !== Math.sign(db)) continue;
    const at = (f) => {
      const mid = (f(c - w) + f(c + w)) / 2;
      for (let i = c - w; i < c + w; i++) {
        if ((f(i) - mid) * (f(i + 1) - mid) <= 0 && f(i) !== f(i + 1)) return i + (mid - f(i)) / (f(i + 1) - f(i));
      }
      return null;
    };
    const xr = at(R), xb = at(B);
    if (xr !== null && xb !== null) out.push(xb - xr);
  }
}

/** { spreads, halo, dx, dy }: the bloom spreads (both sides, both axes), halo colours and the blue-minus-red offsets (along x and y) of one frame. */
export function edgeSamples(P, stride = 2) {
  const out = { spreads: [], halo: [], dx: [], dy: [] };
  for (let y = 0; y < P.h; y += stride) {
    bloomOnLine(P, y * P.w, 1, P.w, out);
    bloomOnLine(P, y * P.w + P.w - 1, -1, P.w, out);
    chromaOnLine(P, y * P.w, 1, P.w, out.dx);
  }
  for (let x = 0; x < P.w; x += stride) {
    bloomOnLine(P, x, P.w, P.h, out);
    bloomOnLine(P, (P.h - 1) * P.w + x, -P.w, P.h, out);
    chromaOnLine(P, x, P.w, P.h, out.dy);
  }
  return out;
}

const HUES = [[15, 'red'], [45, 'orange'], [70, 'yellow'], [160, 'green'], [200, 'cyan'], [260, 'blue'], [320, 'magenta'], [346, 'pink'], [361, 'red']];

/** { hue, sat, name } of an rgb mean: neutral when the saturation is below 0.15. */
export function hueOf(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max > 0 ? (max - min) / max : 0;
  if (sat < 0.15) return { hue: 0, sat: r2(sat), name: 'neutral white' };
  const d = max - min;
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return { hue: Math.round(hue), sat: r2(sat), name: HUES.find(([h]) => hue < h)[1] };
}

/** The numbers of a film from its parts: flashes, per-frame clip shares, edge samples and the best texture. */
export function summarise({ means, fps, clips, edges, texture }) {
  const spreads = edges.flatMap((e) => e.spreads);
  const dx = edges.flatMap((e) => e.dx), dy = edges.flatMap((e) => e.dy);
  const halo = edges.flatMap((e) => e.halo);
  const glowMean = [0, 1, 2].map((c) => halo.reduce((s, h) => s + h[c], 0) / (halo.length || 1));
  const sorted = Float64Array.from(clips).sort();
  return {
    fps,
    frames: means.length,
    luma: { median: Math.round(median(means)), max: Math.round(Math.max(...means)) },
    flashes: flashProfile(means, fps),
    clip: { median: r2(median(clips)), peak: r2(sorted[sorted.length - 1] ?? 0) },
    bloom: spreads.length >= MIN_EDGES ? { px: r1(median(spreads)), n: spreads.length } : null,
    chroma: dx.length + dy.length >= MIN_EDGES ? { dx: r1(dx.length ? median(dx) : 0), dy: r1(dy.length ? median(dy) : 0), share: Math.round((100 * [...dx, ...dy].filter((d) => Math.abs(d) >= 1).length) / (dx.length + dy.length)), n: dx.length + dy.length } : null,
    glow: halo.length >= MIN_EDGES && Math.max(...glowMean) >= GLOW_MIN ? { ...hueOf(...glowMean), n: halo.length } : null,
    texture,
  };
}

const flashText = (f) => `${f.at.toFixed(2)} s, ${f.frames} f, luma ${f.base} to ${f.peak}, rise ${f.rise} f, decay ${f.decay} f`;
const patternText = (t) => {
  if (!t) return 'no dark block';
  if (t.kind === 'none') return `none (peak ${Math.round(t.ratio)}x the band median)`;
  const per = t.kind === 'grid' ? `${r1(t.periodX)} x ${r1(t.periodY)} px` : `${r1(t.period)} px`;
  const colour = t.striped ? `RGB-striped (channels ${t.spreadDeg} deg apart)` : 'monochrome';
  return `${t.kind}, period ${per}, ${colour}`;
};
const chromaText = (c) => (c ? `median dx ${c.dx} px, dy ${c.dy} px; ${c.share}% of ${c.n} edges off by 1 px or more` : 'too few edges');

/** Rows [label, a, b] of the look table; `b` is null for one film. */
export function lookRows(a, b) {
  const both = (fn) => [fn(a), b ? fn(b) : null];
  const rows = [
    ['frames, fps', ...both((m) => `${m.frames}, ${r1(m.fps)}`)],
    ['mean luma median, max', ...both((m) => `${m.luma.median}, ${m.luma.max}`)],
    ['flashes', ...both((m) => String(m.flashes.length))],
  ];
  for (let i = 0; i < Math.min(3, Math.max(a.flashes.length, b?.flashes.length ?? 0)); i++) {
    rows.push([`  flash ${i + 1}`, ...both((m) => (m.flashes[i] ? flashText(m.flashes[i]) : '-'))]);
  }
  rows.push(
    ['clipped >=250, median, peak %', ...both((m) => `${m.clip.median}, ${m.clip.peak}`)],
    ['bloom 90 to 10% (px)', ...both((m) => (m.bloom ? `${m.bloom.px} (gaussian sigma about ${bloomSigma(m.bloom.px)}; ${m.bloom.n} edges)` : 'too few edges'))],
    ['chromatic offset B minus R', ...both((m) => chromaText(m.chroma))],
    ['screen texture', ...both((m) => patternText(m.texture))],
    ['glow colour', ...both((m) => (m.glow ? `${m.glow.name}${m.glow.hue ? ` (hue ${m.glow.hue}, sat ${m.glow.sat})` : ''}` : 'none'))],
  );
  return rows;
}

export function lookTable(a, b, names = ['a', 'b']) {
  const rows = lookRows(a, b);
  const w0 = Math.max(...rows.map((r) => r[0].length));
  const w1 = Math.max(names[0].length, ...rows.map((r) => r[1].length));
  const line = (r) => `${r[0].padEnd(w0)} | ${String(r[1]).padEnd(w1)}${b ? ` | ${r[2]}` : ''}`;
  return [line(['measure', names[0], names[1]]), `${'-'.repeat(w0)}-+-${'-'.repeat(w1)}${b ? '-+----' : ''}`, ...rows.map(line)];
}

const biggest = (m) => m.flashes.reduce((best, f) => (!best || f.peak - f.base > best.peak - best.base ? f : best), null);
const lengthS = (f, m) => f.frames / m.fps;

/** Advice lines for a film `a` (yours) against a reference `b`. Each names the number to change. */
export function advise(a, b) {
  const out = [];
  const fa = biggest(a), fb = biggest(b);
  if (fb && !fa) out.push(`flashes: yours none; ref ${b.flashes.length}, the biggest ${fb.frames} f (${r2(lengthS(fb, b))} s) to luma ${fb.peak}: add a flash`);
  else if (fa && !fb) out.push(`flashes: yours ${fa.frames} f to luma ${fa.peak}; ref has none: remove the flash`);
  else if (fa && fb) {
    const longer = lengthS(fa, a) > 1.5 * lengthS(fb, b), dimmer = fa.peak < 0.85 * fb.peak;
    if (longer || dimmer) out.push(`flashes: yours ${r2(lengthS(fa, a))} s (${fa.frames} f) to luma ${fa.peak}; ref ${r2(lengthS(fb, b))} s (${fb.frames} f) to luma ${fb.peak}: make the flash ${[longer && 'shorter', dimmer && 'brighter'].filter(Boolean).join(' and ')}`);
  }
  if (b.clip.median > 2 * a.clip.median + 0.5 || b.clip.peak > 2 * a.clip.peak + 1) out.push(`clipped share: yours ${a.clip.median}% median and ${a.clip.peak}% peak; ref ${b.clip.median}% and ${b.clip.peak}%: push the brights to full white`);
  if (a.bloom && b.bloom && (b.bloom.px > 1.5 * a.bloom.px + 1 || a.bloom.px > 1.5 * b.bloom.px + 1)) out.push(`bloom: yours ${a.bloom.px} px, ref ${b.bloom.px} px: ${b.bloom.px > a.bloom.px ? 'widen' : 'narrow'} the glow`);
  const mag = (m) => (m.chroma ? Math.hypot(m.chroma.dx, m.chroma.dy) : 0);
  const share = (m) => m.chroma?.share ?? 0;
  if (mag(b) >= 1 && mag(a) < 0.5) out.push(`chromatic offset: ref ${r1(mag(b))} px (dx ${b.chroma.dx}, dy ${b.chroma.dy}), yours ${r1(mag(a))} px: split red and blue by that much`);
  else if (share(b) >= share(a) + 20) out.push(`chromatic offset: ref has 1 px or more on ${share(b)}% of edges, yours ${share(a)}%: add a colour fringe`);
  const ta = a.texture?.kind !== 'none' && a.texture, tb = b.texture?.kind !== 'none' && b.texture;
  if (tb && !ta) out.push(`screen texture: ref has ${patternText(tb)}, yours none: add that pattern`);
  else if (tb && ta && (ta.kind !== tb.kind || Math.abs(ta.period - tb.period) > 0.5 || ta.striped !== tb.striped)) out.push(`screen texture: yours ${patternText(ta)}; ref ${patternText(tb)}: match it`);
  if (a.glow && b.glow && a.glow.name !== b.glow.name) out.push(`glow colour: yours ${a.glow.name}, ref ${b.glow.name}: tint the halo ${b.glow.name}`);
  else if (b.glow && !a.glow) out.push(`glow colour: ref ${b.glow.name}, yours none: add a ${b.glow.name} halo`);
  return out.length ? out : ['no measured gap in these measures: look at the frames with vawe frame'];
}
