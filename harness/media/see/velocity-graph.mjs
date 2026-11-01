// The SVG of `vawe frame --moment <s> --velocity`: speed over time on top, scale over time below, one line per element, a mark at each peak speed. Pure: a string in, no I/O.

export const GRAPH_W = 1200;
export const GRAPH_H = 760;
export const LINE_COLOURS = ['#1f6feb', '#e5484d', '#2f9e44', '#e08a00', '#8250df', '#0b8a8f'];
const M = { l: 70, r: 24, t: 54, mid: 40, b: 44 };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nice = (max) => {
  const mag = 10 ** Math.floor(Math.log10(max || 1));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= max / 4) * mag;
  return { top: Math.ceil(max / step) * step, step };
};

function panel({ x0, x1, y0, y1, from, to, lo, hi, step, title, lines, fmt }) {
  const X = (t) => x0 + ((t - from) / (to - from)) * (x1 - x0);
  const Y = (v) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  const out = [`<text x="${x0}" y="${y0 - 10}" class="h">${esc(title)}</text>`, `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" class="box"/>`];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(`<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${x0 - 8}" y="${Y(v) + 4}" class="tick" text-anchor="end">${fmt(v)}</text>`);
  const tickStep = to - from > 1.5 ? 0.25 : 0.1;
  for (let t = Math.ceil(from / tickStep) * tickStep; t <= to + 1e-9; t += tickStep) out.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${y0}" y2="${y1}" class="grid"/><text x="${X(t)}" y="${y1 + 16}" class="tick" text-anchor="middle">${t.toFixed(2)}</text>`);
  for (const l of lines) {
    out.push(`<polyline points="${l.points.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${l.colour}" stroke-width="2.2" stroke-linejoin="round"/>`);
    if (l.peak) out.push(`<circle cx="${X(l.peak.t).toFixed(1)}" cy="${Y(l.peak.v).toFixed(1)}" r="5.5" fill="#fff" stroke="${l.colour}" stroke-width="2.4"/>`);
  }
  return out.join('');
}

/** The SVG of a graph. `series` is [{ label, colour, speed: [{ t, v }], peak: { t, v } | null, rel: [{ t, v }] | null }]; `rel` is drawn only when set. Pure. */
export function velocitySvg({ from, to, series }) {
  const top = nice(Math.max(0.1, ...series.flatMap((s) => s.speed.map((p) => p.v))));
  const rels = series.filter((s) => s.rel);
  const relVals = rels.flatMap((s) => s.rel.map((p) => p.v));
  const lowest = Math.min(1, ...relVals), highest = Math.max(1.1, ...relVals);
  const scale = nice(highest - lowest);
  const lo = Math.floor(lowest / scale.step + 1e-9) * scale.step, hi = Math.ceil(highest / scale.step - 1e-9) * scale.step;
  const x0 = M.l, x1 = GRAPH_W - M.r;
  const body = GRAPH_H - M.t - M.b - M.mid;
  const topPanel = { x0, x1, y0: M.t, y1: M.t + body * 0.55, from, to, lo: 0, hi: top.top, step: top.step, title: 'speed, frame heights per second (circle: peak)', lines: series.map((s) => ({ points: s.speed, colour: s.colour, peak: s.peak })), fmt: (v) => v.toFixed(2) };
  const botY0 = topPanel.y1 + M.mid;
  const botPanel = { x0, x1, y0: botY0, y1: GRAPH_H - M.b, from, to, lo, hi, step: scale.step, title: rels.length ? 'scale, 1.00 is the size at the end of the window' : 'scale: no element in the graph changes size', lines: rels.map((s) => ({ points: s.rel, colour: s.colour, peak: null })), fmt: (v) => v.toFixed(2) };
  const legend = series.map((s, i) => `<rect x="${x0 + i * 280}" y="16" width="14" height="14" fill="${s.colour}"/><text x="${x0 + i * 280 + 20}" y="28" class="leg">${esc(s.label.slice(0, 30))}</text>`).join('');
  const style = '.h{font:600 14px system-ui,sans-serif;fill:#111}.tick{font:12px system-ui,sans-serif;fill:#555}.leg{font:13px system-ui,sans-serif;fill:#111}.grid{stroke:#e3e5e8;stroke-width:1}.box{fill:none;stroke:#9aa0a8}';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GRAPH_W}" height="${GRAPH_H}" viewBox="0 0 ${GRAPH_W} ${GRAPH_H}"><style>${style}</style><rect width="100%" height="100%" fill="#fff"/>${legend}${panel(topPanel)}${panel(botPanel)}<text x="${(x0 + x1) / 2}" y="${GRAPH_H - 8}" class="tick" text-anchor="middle">film time, seconds</text></svg>`;
}
