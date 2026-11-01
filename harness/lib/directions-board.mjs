// The comparison board of a film's directions (`vawe storyboard <page> --directions`): one column per direction, the same moments
// and the same lines in each. Pure: parsed brief slots and image paths in, one HTML string out. Images are relative paths.
import { esc } from './storyboard-html.mjs';

export const MOMENTS = [['opening', 'opening'], ['turn', 'the turn'], ['end', 'end']];
export const NOT_WRITTEN = 'not written';
export const FALLBACK_LINE = 'One still per direction from directions.html. Test pages at films/<name>/directions/<a|b|c>/page.html give the full grid and a clip of each turn.';

const LINES = [
  ['idea', (f) => f.sentence],
  ['what you see', (f) => f['key frame']],
  ['what carries the eye', (f) => [f.thread, f.move && `move: ${f.move}`].filter(Boolean).join('; ')],
  ['risk', (f) => f.risk],
  ['drawn from', (f) => f.from],
];

/** The five lines of one slot, always in this order; a field the brief leaves empty or as a [placeholder] reads "not written". */
export function linesOf(fields = {}) {
  return LINES.map(([label, pick]) => {
    const v = (pick(fields) ?? '').trim();
    return { label, text: v && !/^\[.*\]$/.test(v) ? v : NOT_WRITTEN };
  });
}

const CSS = `:root{--bg:#f4f2ee;--ink:#15171a;--mute:#6b6f76;--line:#d9d5cc;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#121315;--ink:#ecebe8;--mute:#9a9da3;--line:#2b2d31;--card:#1a1b1e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 Geist,system-ui,sans-serif;padding:24px 16px}
h1{font-size:18px;margin:0 0 4px}.sub{color:var(--mute);margin:0 0 20px;font:12px 'IBM Plex Mono',ui-monospace,monospace}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
@media (max-width:900px){.grid{grid-template-columns:1fr}}
.col{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;display:grid;gap:10px;min-width:0}
.col h2{font-size:15px;margin:0}.col h2 small{color:var(--mute);font-weight:400}
figure{margin:0}figure img,figure video{display:block;width:100%;height:auto;border-radius:4px;background:#000}
figcaption{font:11px 'IBM Plex Mono',ui-monospace,monospace;color:var(--mute);margin-top:3px}
.empty{border:1px dashed var(--line);border-radius:4px;aspect-ratio:16/9;display:grid;place-items:center;color:var(--mute);font-size:12px}
dl{margin:0;display:grid;gap:6px}dt{font:11px 'IBM Plex Mono',ui-monospace,monospace;color:var(--mute);text-transform:uppercase}
dd{margin:0}dd.none{color:var(--mute);font-style:italic}
.pick{margin-top:20px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.pick p{margin:2px 0}
.note{color:var(--mute);font-size:12px;margin:0 0 12px}`;

const cell = (img, label) => (img
  ? `<figure><a href="${esc(img.src)}"><img src="${esc(img.src)}" alt="${esc(label)}" loading="eager"></a><figcaption>${esc(label)}${img.at == null ? '' : ` at ${img.at.toFixed(2)} s`}</figcaption></figure>`
  : `<figure><div class="empty">no still</div><figcaption>${esc(label)}</figcaption></figure>`);

const clipCell = (src) => (src
  ? `<figure><video src="${esc(src)}" autoplay muted loop playsinline></video><figcaption>the turn, looping</figcaption></figure>`
  : '<figure><div class="empty">no clip</div><figcaption>the turn, looping</figcaption></figure>');

function column(id, fields, media, fallback) {
  const rows = fallback ? [cell(media.stills?.key, 'key frame')] : [...MOMENTS.map(([k, label]) => cell(media.stills?.[k], label)), clipCell(media.clip)];
  const lines = linesOf(fields).map((l) => `<dt>${esc(l.label)}</dt><dd${l.text === NOT_WRITTEN ? ' class="none"' : ''}>${esc(l.text)}</dd>`).join('');
  const family = fields.family ? ` <small>${esc(fields.family)}</small>` : '';
  return `<section class="col" id="dir-${esc(id)}"><h2>${esc(id)}${family}</h2>${rows.join('')}<dl>${lines}</dl></section>`;
}

/**
 * `slots` is parseDirections(brief).slots, `picked` its picked value. `media` maps a slot id to { stills: { opening, turn, end } | { key }, clip },
 * a still being { src, at }. `fallback` is true when no direction has a test page: one key frame each, no clip row.
 */
export function directionsBoardHtml({ film, slots, picked, media = {}, fallback = false, fontCss = '' }) {
  const ids = slots.length ? slots.map((s) => s.id) : ['A', 'B', 'C'];
  const fieldsOf = (id) => slots.find((s) => s.id === id)?.fields ?? {};
  const cols = ids.map((id) => column(id, fieldsOf(id), media[id] ?? {}, fallback)).join('');
  const options = ids.map((id) => { const idea = linesOf(fieldsOf(id))[0].text; return idea === NOT_WRITTEN ? id : `${id} (${idea})`; }).join(', ');
  const pick = picked?.id ? `${esc(picked.id)}${picked.reason ? `, because ${esc(picked.reason)}` : ''}` : NOT_WRITTEN;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(film)} directions</title><style>${fontCss}\n${CSS}</style></head>
<body><h1>${esc(film)}: directions</h1><p class="sub">${ids.length} directions, the same moments and the same lines in each</p>
${fallback ? `<p class="note">${esc(FALLBACK_LINE)}</p>` : ''}
<div class="grid">${cols}</div>
<div class="pick"><p><b>My pick:</b> ${pick}</p><p><b>Which one:</b> ${esc(options)}?</p></div>
</body></html>
`;
}
