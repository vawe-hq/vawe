// The one owner of the artboard sheet: frames at true aspect on a quiet canvas, a label line above each one. `vawe frame --world all` writes it
// as films/<film>/frames.html and a PNG of it; `vawe frame` (so `vawe-dev moves --only`) writes the same layout. Time strips are not
// artboards and keep tile.mjs.

export const ARTBOARD = {
  width: 2160,
  gapRatio: 0.06,
  maxCols: 3,
  labelSizeRatio: 0.03,
  labelGapRatio: 0.45,
  canvas: '#ecebe8',
  label: '#7a7973',
  outline: 'rgba(20, 20, 18, 0.16)',
  shadow: '0 0.9cqw 2.4cqw rgba(20, 20, 18, 0.12)',
  font: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Columns for `count` frames: as few rows as `maxCols` allows, then the fewest columns that keep them (4 gives 2 and 2, never 3 and 1). Pure. */
export function artboardColumns(count, maxCols = ARTBOARD.maxCols) {
  const rows = Math.ceil(count / maxCols);
  return Math.ceil(count / rows);
}

/** "w:h" or "w/h" as a number. Pure. */
export const aspectRatio = (aspect = '16:9') => {
  const [w, h] = String(aspect).split(/[:/]/).map(Number);
  return w > 0 && h > 0 ? w / h : 16 / 9;
};

/**
 * Pixel boxes of the sheet: { width, height, cols, gap, fontSize, items: [{ frame, label }] }, each box { x, y, w, h }. Frames share one
 * gap between each other and at the margins; a label box sits above its frame and spans its width; a short last row is centred. Pure.
 */
export function artboardLayout({ count, aspect = '16:9', width = ARTBOARD.width, cols = artboardColumns(count) }) {
  if (!(count > 0)) throw new Error('artboardLayout: no frames');
  const frameW = Math.floor(width / (cols + (cols + 1) * ARTBOARD.gapRatio));
  const gap = Math.round(frameW * ARTBOARD.gapRatio);
  const frameH = Math.round(frameW / aspectRatio(aspect));
  const fontSize = Math.round(frameW * ARTBOARD.labelSizeRatio);
  const labelH = Math.round(fontSize * 1.4);
  const labelGap = Math.round(fontSize * ARTBOARD.labelGapRatio);
  const rows = Math.ceil(count / cols);
  const pitch = labelH + labelGap + frameH + gap;
  const items = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, count - row * cols);
    const x = gap + Math.round((cols - inRow) * (frameW + gap) / 2) + (i % cols) * (frameW + gap);
    const top = gap + row * pitch;
    return { label: { x, y: top, w: frameW, h: labelH }, frame: { x, y: top + labelH + labelGap, w: frameW, h: frameH } };
  });
  return { width: cols * frameW + (cols + 1) * gap, height: gap + rows * pitch, cols, gap, fontSize, items };
}

/** The cut span [start, end] of each world, in the order given: from its start to the next world's start (the last to `duration`, the earliest from 0), so the spans tile 0 to `duration`. Pure. */
export function cutSpans(spans, duration) {
  const timed = spans.map((s, i) => ({ i, start: s.start })).filter((s) => Number.isFinite(s.start)).sort((a, b) => a.start - b.start);
  const out = spans.map(() => [NaN, NaN]);
  timed.forEach((s, k) => { out[s.i] = [k === 0 ? 0 : s.start, k + 1 < timed.length ? timed[k + 1].start : duration]; });
  return out;
}

/** The left and right text of a label line: "01  hook" and "0.0 to 4.0 s". Pure. */
export const artboardCaption = (index, name, start, end) => ({
  left: `${String(index + 1).padStart(2, '0')}  ${name}`.trimEnd(),
  right: Number.isFinite(start) && Number.isFinite(end) ? `${start.toFixed(1)} to ${end.toFixed(1)} s` : '',
});

const pct = (v, total) => `${+(v / total * 100).toFixed(4)}%`;
const box = (b, L) => `left:${pct(b.x, L.width)};top:${pct(b.y, L.height)};width:${pct(b.w, L.width)};height:${pct(b.h, L.height)}`;

const SCRIPT = `
const frames = [...document.querySelectorAll('.board img')];
const view = document.querySelector('.view'), big = view.querySelector('img'), cap = view.querySelector('span');
let at = 0;
const show = (i) => { at = (i + frames.length) % frames.length; big.src = frames[at].dataset.full || frames[at].src; cap.textContent = frames[at].alt; view.hidden = false; };
frames.forEach((f, i) => f.addEventListener('click', () => show(i)));
view.addEventListener('click', () => { view.hidden = true; });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') view.hidden = true;
  else if (!view.hidden && e.key === 'ArrowRight') show(at + 1);
  else if (!view.hidden && e.key === 'ArrowLeft') show(at - 1);
});`;

/**
 * The sheet as one html page. `items` are [{ left, right, src, alt, full? }] with src (and the optional full-size `full`) relative to the
 * page; `fontHref` is the face file relative to the page. A click on a frame opens it at full size, the arrow keys step. Pure.
 */
export function artboardHtml({ title, aspect = '16:9', layout, items, fontHref }) {
  const A = ARTBOARD;
  const cells = items.map((it, i) => {
    const { label, frame } = layout.items[i];
    return `<div class="label" style="${box(label, layout)}"><span>${escape(it.left)}</span><span class="num">${escape(it.right || '')}</span></div>
<img class="frame" style="${box(frame, layout)}" src="${escape(it.src)}" alt="${escape(it.alt ?? it.left)}"${it.full ? ` data-full="${escape(it.full)}"` : ''}>`;
  }).join('\n');
  return `<!doctype html>
<html data-aspect="${escape(aspect)}">
<head>
<meta charset="utf-8">
<meta name="duration" content="1">
<title>${escape(title)}</title>
<style>
  @font-face { font-family: Inter; src: url("${escape(fontHref)}"); font-weight: 100 900; }
  html, body { margin: 0; background: ${A.canvas}; }
  .board { position: relative; width: 100%; aspect-ratio: ${layout.width} / ${layout.height}; container-type: inline-size; font-family: ${A.font}; }
  .label { position: absolute; display: flex; justify-content: space-between; align-items: flex-end; box-sizing: border-box;
           font-size: ${+(layout.fontSize / layout.width * 100).toFixed(4)}cqw; line-height: 1.4; color: ${A.label}; white-space: nowrap; }
  .num { font-variant-numeric: tabular-nums; }
  .frame { position: absolute; display: block; object-fit: cover; background: #fff; cursor: zoom-in; box-shadow: 0 0 0 1px ${A.outline}, ${A.shadow}; }
  .view { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(236, 235, 232, 0.96); cursor: zoom-out; font-family: ${A.font}; }
  .view[hidden] { display: none; }
  .view img { max-width: 94vw; max-height: 90vh; box-shadow: 0 0 0 1px ${A.outline}; }
  .view span { position: fixed; top: 2vh; left: 3vw; color: ${A.label}; font-size: 14px; }
</style>
</head>
<body>
<div class="board">
${cells}
</div>
<div class="view" hidden><span></span><img alt=""></div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
