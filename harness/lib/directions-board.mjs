// The comparison board of a film's directions (`vawe frame <page> --directions`): one column per direction, the same moments
// and the same lines in each. Pure: parsed brief slots and image paths in, one HTML string out. Images are relative paths.
import { esc } from './storyboard-html.mjs';

export const MOMENTS = [['opening', 'Start'], ['turn', 'The big moment'], ['end', 'End']];
export const NOT_WRITTEN = 'not written';
export const FALLBACK_LINE = 'Only one picture per direction so far. A short sample film of each direction would add the start, the big moment, the end and a moving clip.';

const written = (v) => { const t = (v ?? '').trim(); return t && !/^\[.*\]$/.test(t) ? t : ''; };
const eye = (f) => [written(f.thread).replace(/\.$/, ''), written(f.move) && `move: ${written(f.move)}`].filter(Boolean).join('; ');

const LINES = [
  ['The idea', (f) => written(f.sentence)],
  ['What you see happen', (f) => written(f['key frame'])],
  ['Where your eye goes', eye],
  ['What could go wrong', (f) => written(f.risk)],
  ['Inspired by', (f) => written(f.from)],
];

/** The five lines of one slot, always in this order; a field the brief leaves empty or as a [placeholder] reads "not written". */
export function linesOf(fields = {}) {
  return LINES.map(([label, pick]) => ({ label, text: pick(fields) || NOT_WRITTEN }));
}

/** The pick as the brief wrote it ("B with C's squeegee, because ..."); "because" is added only when the text has none. */
export function pickText(picked) {
  if (!picked?.id) return NOT_WRITTEN;
  if (!picked.reason) return picked.id;
  return /\bbecause\b/i.test(picked.reason) ? `${picked.id} ${picked.reason}` : `${picked.id}, because ${picked.reason}`;
}

/** A short name for the question: the family without its hint, else the first words of the idea, else the id. */
export function optionName(id, fields = {}) {
  const family = written(fields.family).replace(/\s*\(.*$/, '');
  const idea = written(fields.sentence).split(/\s+/).slice(0, 4).join(' ');
  const name = family || idea;
  return name ? `${id} (${name})` : id;
}

const CSS = `:root{--bg:#f4f2ee;--ink:#15171a;--mute:#6b6f76;--line:#d9d5cc;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#121315;--ink:#ecebe8;--mute:#9a9da3;--line:#2b2d31;--card:#1a1b1e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 Geist,system-ui,sans-serif;padding:24px 16px}
h1{font-size:18px;margin:0 0 4px}.sub{color:var(--mute);margin:0 0 20px;font:12px 'IBM Plex Mono',ui-monospace,monospace}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:16px;row-gap:0}
.col{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;display:grid;grid-row:span var(--rows);grid-template-rows:subgrid;row-gap:10px;min-width:0}
@media (max-width:900px){.grid{grid-template-columns:1fr;row-gap:16px}.col{grid-row:auto;grid-template-rows:none}}
.col h2{font-size:15px;margin:0}.col h2 small{color:var(--mute);font-weight:400}
figure{margin:0}figure img,figure video{display:block;width:100%;height:auto;border-radius:4px;background:#000}
figcaption{font:11px 'IBM Plex Mono',ui-monospace,monospace;color:var(--mute);margin-top:3px}
.empty{border:1px dashed var(--line);border-radius:4px;aspect-ratio:16/9;display:grid;place-items:center;color:var(--mute);font-size:12px}
.k{font:11px 'IBM Plex Mono',ui-monospace,monospace;color:var(--mute);text-transform:uppercase}
.v{margin:2px 0 0}.v.none{color:var(--mute);font-style:italic}
.pick{margin-top:20px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.pick p{margin:2px 0}
.note{color:var(--mute);font-size:12px;margin:0 0 12px}`;

const cell = (img, label) => (img
  ? `<figure><a href="${esc(img.src)}"><img src="${esc(img.src)}" alt="${esc(label)}" loading="eager"></a><figcaption>${esc(label)}${img.at == null ? '' : ` at ${img.at.toFixed(2)} s`}</figcaption></figure>`
  : `<figure><div class="empty">no still</div><figcaption>${esc(label)}</figcaption></figure>`);

const clipCell = (src) => (src
  ? `<figure><video src="${esc(src)}" autoplay muted loop playsinline></video><figcaption>The big moment, playing</figcaption></figure>`
  : '<figure><div class="empty">no clip</div><figcaption>The big moment, playing</figcaption></figure>');

const noPage = (label) => `<figure><div class="empty">no sample film</div><figcaption>${esc(label)}</figcaption></figure>`;

function mediaCells(m, fullGrid) {
  if (m.stills?.key) {
    const key = cell(m.stills.key, 'the picture');
    return fullGrid ? [noPage('Start'), key, noPage('End'), noPage('The big moment, playing')] : [key];
  }
  if (!fullGrid) return [cell(undefined, 'the picture')];
  return [...MOMENTS.map(([k, label]) => cell(m.stills?.[k], label)), clipCell(m.clip)];
}

function column(id, fields, media, fullGrid) {
  const rows = mediaCells(media, fullGrid);
  const lines = linesOf(fields).map((l) => `<div class="line"><div class="k">${esc(l.label)}</div><div class="v${l.text === NOT_WRITTEN ? ' none' : ''}">${esc(l.text)}</div></div>`);
  const family = fields.family ? ` <small>${esc(fields.family)}</small>` : '';
  const total = 1 + rows.length + lines.length;
  return `<section class="col" id="dir-${esc(id)}" style="--rows:${total}"><h2>${esc(id)}${family}</h2>${rows.join('')}${lines.join('')}</section>`;
}

/**
 * `slots` is parseDirections(brief).slots, `picked` its picked value. `media` maps a slot id to { stills: { opening, turn, end } | { key }, clip },
 * a still being { src, at }. A direction with `stills.key` has no sample film: its key frame from directions.html stands in.
 */
export function directionsBoardHtml({ film, slots, picked, media = {}, fontCss = '' }) {
  const found = Object.keys(media).sort();
  const ids = slots.length ? slots.map((s) => s.id) : found.length ? found : ['A', 'B', 'C'];
  const keyOnly = (id) => Boolean(media[id]?.stills?.key);
  const fallback = ids.some(keyOnly);
  const fullGrid = ids.some((id) => media[id] && !keyOnly(id));
  const fieldsOf = (id) => slots.find((s) => s.id === id)?.fields ?? {};
  const cols = ids.map((id) => column(id, fieldsOf(id), media[id] ?? {}, fullGrid)).join('');
  const options = ids.map((id) => optionName(id, fieldsOf(id))).join(', ');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(film)} directions</title><style>${fontCss}\n${CSS}</style></head>
<body><h1>${esc(film)}: directions</h1><p class="sub">${ids.length} directions, each shown the same way</p>
${fallback ? `<p class="note">${esc(FALLBACK_LINE)}</p>` : ''}
<div class="grid">${cols}</div>
<div class="pick"><p><b>My pick:</b> ${esc(pickText(picked))}</p><p><b>Which one do you want?</b> ${esc(options)}</p></div>
</body></html>
`;
}
