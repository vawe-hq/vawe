// The one self-contained HTML page of `vawe storyboard`: frame cards in a row, the scene-change arrows between them and a rhythm strip,
// on a canvas you pan and zoom. Pure: board data (harness/lib/storyboard.mjs) in, one string out. Images are relative paths.
import { storyboardScript } from './storyboard-script.mjs';
import { BOARD_LABELS as L } from './plain-words.mjs';

export const CARD_W = 416;
export const PER_ROW = 5;
const LINK_W = 168;
const PAD = 120;

const EASE_SOURCE = { page: 'read from the page', board: 'named in the Board', signature: L.easeDial };
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const voiceName = (v) => String(v).replace(/\.(mp3|wav|m4a|ogg|flac)$/i, '');
const MAX_CHIPS = 6;
const MAX_LABEL_ROWS = 3;
const sec = (n) => `${(Math.round(n * 100) / 100).toFixed(2)} s`;

/** The SVG path of ease points [[u, y]] in a w by h box; y outside 0..1 (an overshoot) widens the box range. Pure. */
export function curvePath(points, w = 72, h = 40, pad = 5) {
  const ys = points.map((p) => p[1]);
  const [lo, hi] = [Math.min(0, ...ys), Math.max(1, ...ys)];
  const x = (u) => pad + u * (w - 2 * pad);
  const y = (v) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad);
  return { d: points.map(([u, v], i) => `${i ? 'L' : 'M'}${x(u).toFixed(1)} ${y(v).toFixed(1)}`).join(' '), y0: y(0), y1: y(1), end: [x(1), y(points.at(-1)[1])] };
}

function curveSvg(ease) {
  if (!ease?.points) return '';
  const c = curvePath(ease.points);
  return `<svg class="curve" viewBox="0 0 72 40" aria-hidden="true"><line x1="5" x2="67" y1="${c.y0.toFixed(1)}" y2="${c.y0.toFixed(1)}"/><line x1="5" x2="67" y1="${c.y1.toFixed(1)}" y2="${c.y1.toFixed(1)}"/><path d="${c.d}"/><circle cx="${c.end[0].toFixed(1)}" cy="${c.end[1].toFixed(1)}" r="2.6"/></svg>`;
}

function card(s, board, image) {
  const spectacle = board.spectacle?.world === s.id;
  const cues = s.cues.slice(0, MAX_CHIPS).map((c) => `<li><i>${c.at.toFixed(2)}</i>${esc(voiceName(c.voice))}</li>`).join('') + (s.cues.length > MAX_CHIPS ? `<li class="more">+${s.cues.length - MAX_CHIPS} more</li>` : '');
  const move = s.move ? `<div class="row move"><span class="k">move</span><div><b>${esc(s.move)}</b>${s.moveDetail ? `<small>${esc(s.moveDetail)}</small>` : ''}</div></div>` : '';
  const ease = s.ease ? `<div class="row ease"><span class="k">${L.speed}</span>${curveSvg(s.ease)}<div><b>${esc(s.ease.name)}</b><small>${EASE_SOURCE[s.ease.source]}</small></div></div>` : '';
  return `<article class="shot${spectacle ? ' spectacle' : ''}" id="shot-${esc(s.id)}" style="--ground:${esc(s.ground ?? '#3a3a40')}">
  <header class="tag"><span class="no">${String(s.n).padStart(2, '0')}</span><span class="id">${esc(s.id)}</span>${spectacle ? `<span class="flag">${L.bigMoment}</span>` : ''}<span class="dur">${sec(s.duration)}</span></header>
  <a class="frame" href="${esc(image)}" data-full><img src="${esc(image)}" alt="${esc(s.id)} at ${s.at} s" loading="eager" draggable="false"><span class="at">frame at ${s.at.toFixed(2)} s</span></a>
  <div class="tc"><span>${s.in}</span><span class="bar"></span><span>${s.out}</span></div>
  <div class="body">
    ${s.action ? `<p class="action">${esc(s.action)}</p>` : ''}
    ${move}${ease}
    ${cues ? `<div class="row snd"><span class="k">sound</span><ul>${cues}</ul></div>` : ''}
    ${s.note ? `<div class="note"><span class="k">${L.movementCheck}</span>${esc(s.note)}</div>` : ''}
  </div>
</article>`;
}

function link(t, last) {
  const label = t.hard ? L.straightCut : sec(t.length);
  return `<div class="link${t.hard ? ' hard' : ''}${last ? ' wrap' : ''}" title="${esc(`${t.from} to ${t.to}${t.object ? `: ${t.object}` : ''}`)}">
    <span class="pill"><b>${esc(t.name)}</b><i>${label}</i></span>
    ${last ? '<span class="obj">continues on the next row</span>' : `<svg viewBox="0 0 ${LINK_W} 14" aria-hidden="true"><line x1="2" y1="7" x2="${LINK_W - 12}" y2="7"/><path d="M${LINK_W - 14} 1 L${LINK_W - 2} 7 L${LINK_W - 14} 13 Z"/></svg>`}
    ${t.object ? `<span class="obj">${esc(t.object)}</span>` : ''}
  </div>`;
}

const pct = (t, dur) => `${((t / dur) * 100).toFixed(3)}%`;
const inkOn = (ground) => {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(ground ?? '');
  if (!m) return '#f2f2f3';
  return 0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3] > 150 ? '#111' : '#fff';
};

// Cue labels go on the first sub-row where the previous label has ended, so close cues never overprint.
function cueRowsFor(cues, dur, widthPx) {
  const ends = [];
  return cues.map((c) => {
    const x = (c.at / dur) * widthPx;
    let row = ends.findIndex((e) => e + 6 <= x);
    if (row < 0) row = ends.length;
    ends[row] = x + 8 + c.voice.length * 6.4 + 34;
    return { ...c, row };
  });
}

// A shot that overlaps the previous one in time goes on the next lane down, like layers in a timeline.
function shotLanes(shots) {
  const ends = [];
  return shots.map((s) => {
    let lane = ends.findIndex((e) => e <= s.start + 1e-9);
    if (lane < 0) lane = ends.length;
    ends[lane] = s.end;
    return lane;
  });
}

function strip(board, widthPx) {
  const { duration: dur } = board;
  const step = dur <= 8 ? 0.5 : dur <= 30 ? 1 : 5;
  const ticks = Array.from({ length: Math.floor(dur / step) + 1 }, (_, i) => i * step);
  const placed = cueRowsFor(board.cues, dur, widthPx);
  const rows = Math.min(MAX_LABEL_ROWS, Math.max(1, ...placed.map((c) => c.row + 1)));
  const lanes = shotLanes(board.shots);
  const nLanes = Math.max(...lanes) + 1;
  const blocks = board.shots.map((s, i) => `<div class="blk" style="left:${pct(s.start, dur)};width:${pct(s.end - s.start, dur)};top:${lanes[i] * 46}px;background:${esc(s.ground ?? '#3a3a40')};color:${inkOn(s.ground)}"><b>${String(s.n).padStart(2, '0')}</b><span>${esc(s.id)}</span><i>${sec(s.duration)}</i></div>`).join('');
  const hand = board.transitions.map((t) => (t.band
    ? `<div class="span" style="left:${pct(t.band[0], dur)};width:${pct(t.band[1] - t.band[0], dur)}"><span>${esc(t.name)} ${t.length.toFixed(2)}</span></div>`
    : `<div class="dot" style="left:${pct(board.shots.find((s) => s.id === t.to).start, dur)}"><span>${esc(t.name)}</span></div>`)).join('');
  const cuts = board.shots.slice(1).map((s) => `<div class="cutmark" style="left:${pct(s.start, dur)}"></div>`).join('');
  const cueTicks = placed.map((c) => `<div class="tick" style="left:${pct(c.at, dur)};--r:${c.row}">${c.row < MAX_LABEL_ROWS ? `<span>${esc(voiceName(c.voice))} <i>${c.at.toFixed(2)}</i></span>` : ''}</div>`).join('');
  const bed = board.bed.map((b) => `<div class="bed" style="left:${pct(b.at, dur)};right:0"><span>${esc(b.voice)} bed</span></div>`).join('');
  const spec = board.spectacle ? `<div class="spec" style="left:${pct(board.spectacle.at, dur)}"><span>${L.bigMoment} ${board.spectacle.at.toFixed(2)} s</span></div>` : '';
  return `<section class="strip" style="width:${widthPx}px">
  <header class="tag"><span class="no">&#9654;</span><span class="id">${L.timing}</span><span class="dur">${sec(dur)} &middot; ${board.shots.length} ${L.scenes}</span></header>
  <div class="lanes">
    <div class="ruler">${ticks.map((t) => `<span style="left:${pct(t, dur)}">${Number.isInteger(t) ? t : t.toFixed(1)}</span>`).join('')}</div>
    <div class="lane shots" style="height:${nLanes * 46 - 4}px">${blocks}</div>
    <div class="lane hand"><i class="cap">${L.sceneChange}</i>${hand}</div>
    <div class="lane sound" style="height:${12 + rows * 20}px"><i class="cap">sound</i>${bed}${cueTicks}</div>
    <div class="overlay">${cuts}${spec}</div>
  </div>
  <footer><span class="key"><i class="sw sw-span"></i>${L.sceneChangeLength}</span><span class="key"><i class="sw sw-snd"></i>sound cue</span><span class="key"><i class="sw sw-spec"></i>${L.bigMoment}</span><span class="key"><i class="sw sw-cut"></i>${L.cut}</span></footer>
</section>`;
}

function planPanel(plan) {
  if (!plan?.length) return '';
  return `<section class="plan"><span class="k">${L.fromDocs}</span><ul>${plan.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>`;
}

function rowsOfCards(board, images) {
  const out = [];
  for (let i = 0; i < board.shots.length; i += PER_ROW) {
    const chunk = board.shots.slice(i, i + PER_ROW);
    const parts = chunk.map((s, j) => {
      const t = board.transitions[i + j];
      return card(s, board, images[s.id]) + (t ? link(t, j === chunk.length - 1) : '');
    });
    out.push(`<div class="cards">${parts.join('\n')}</div>`);
  }
  return out.join('\n');
}

const CSS = `
:root{--bg:#0a0a0b;--panel:#131315;--panel2:#1a1a1d;--line:#2a2a2e;--line2:#3a3a40;--ink:#f2f2f3;--ink2:#c9c9ce;--muted:#8b8b93;--accent:#3291ff;--spec:#ffb224;--snd:#0eaf80;--note:#f6d86b;
--sans:"Geist",ui-sans-serif,system-ui,sans-serif;--mono:"IBM Plex Mono","Geist Mono",ui-monospace,monospace}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:var(--sans);overflow:hidden;-webkit-font-smoothing:antialiased}
#viewport{position:fixed;inset:0;cursor:grab;touch-action:none;background-image:radial-gradient(circle,#2b2b30 1.2px,transparent 1.4px);background-size:32px 32px}
#viewport.panning{cursor:grabbing}
#world{position:absolute;left:0;top:0;transform-origin:0 0;padding:${PAD}px;will-change:transform}
.head{display:flex;align-items:baseline;gap:28px;margin-bottom:72px}
.head h1{margin:0;font-size:64px;font-weight:600;letter-spacing:-.045em;line-height:1}
.head .meta{font:400 14px/1.5 var(--mono);color:var(--muted);display:flex;flex-direction:column;gap:2px}
.head .meta b{color:var(--ink2);font-weight:500}
.head .msg{font:400 20px/1.35 var(--sans);color:var(--ink2);max-width:640px;letter-spacing:-.01em}
.plan{margin:-24px 0 56px;max-width:${CARD_W * 3}px;background:color-mix(in srgb,var(--spec) 9%,var(--panel));border:1px solid color-mix(in srgb,var(--spec) 35%,transparent);border-radius:10px;padding:14px 16px}
.plan .k{display:block;margin-bottom:8px;font:500 10.5px/1 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--spec)}
.plan ul{margin:0;padding-left:18px;font:400 13px/1.5 var(--sans);color:var(--ink2)}
.cards{display:flex;align-items:flex-start;margin-bottom:96px}
.tag{display:flex;align-items:center;gap:10px;font:500 13px/1 var(--mono);color:var(--muted);padding:0 2px 10px;white-space:nowrap}
.tag .no{color:var(--ink);font-weight:500}.tag .id{color:var(--ink2);text-transform:none}
.tag .dur{margin-left:auto}.tag .flag{color:#111;background:var(--spec);padding:3px 7px;border-radius:99px;font-size:11px;font-weight:500}
.shot{width:${CARD_W}px;flex:none}
.frame{display:block;position:relative;border-radius:10px;overflow:hidden;background:var(--ground);box-shadow:0 0 0 1px var(--line2),0 18px 40px -18px #000;line-height:0;cursor:zoom-in}
.frame img{width:100%;display:block;user-select:none;-webkit-user-drag:none}
.frame .at{position:absolute;left:8px;bottom:8px;font:500 11px/1 var(--mono);color:#fff;background:#000a;backdrop-filter:blur(6px);padding:5px 7px;border-radius:6px;opacity:0;transition:opacity .15s}
.frame:hover .at{opacity:1}
.shot.spectacle .frame{box-shadow:0 0 0 2px var(--spec),0 18px 40px -18px #000}
.tc{display:flex;align-items:center;gap:8px;font:400 12px/1 var(--mono);color:var(--muted);padding:10px 2px 14px}
.tc .bar{flex:1;height:1px;background:var(--line2);position:relative}
.tc .bar::before,.tc .bar::after{content:"";position:absolute;top:-3px;width:1px;height:7px;background:var(--muted)}.tc .bar::before{left:0}.tc .bar::after{right:0}
.body{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 14px 4px}
.action{margin:0 0 12px;font-size:16px;line-height:1.38;letter-spacing:-.012em;color:var(--ink)}
.row{display:grid;grid-template-columns:52px 1fr;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
.row .k,.note .k{font:500 10.5px/1 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.row b{font:500 13px/1.3 var(--mono);color:var(--ink);display:block}
.row small{display:block;font:400 12.5px/1.35 var(--sans);color:var(--muted);margin-top:2px}
.row.ease{grid-template-columns:52px 72px 1fr}
.curve{width:72px;height:40px;background:var(--panel2);border-radius:6px}
.curve line{stroke:var(--line2);stroke-width:1;stroke-dasharray:2 3}.curve path{fill:none;stroke:var(--accent);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.curve circle{fill:var(--accent)}
.snd ul{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.snd li{font:400 12px/1 var(--mono);color:var(--ink2);background:color-mix(in srgb,var(--snd) 16%,transparent);border:1px solid color-mix(in srgb,var(--snd) 45%,transparent);padding:5px 8px;border-radius:99px}
.snd li.more{color:var(--muted);background:none;border-color:var(--line2)}
.snd li i{font-style:normal;color:var(--snd);margin-right:6px}
.note{margin:6px -14px 0;padding:12px 14px 14px;background:color-mix(in srgb,var(--note) 10%,var(--panel));border-top:1px solid color-mix(in srgb,var(--note) 30%,transparent);border-radius:0 0 10px 10px;font:400 13px/1.45 var(--sans);color:var(--ink2)}
.note .k{display:block;margin-bottom:6px;color:var(--note)}
.link{width:${LINK_W}px;flex:none;align-self:flex-start;margin-top:${Math.round(CARD_W * 9 / 32 - 6)}px;display:flex;flex-direction:column;align-items:center;gap:8px;position:relative}
.link svg{width:100%;height:14px;overflow:visible}.link line{stroke:var(--ink2);stroke-width:2}.link path{fill:var(--ink2)}
.link.hard line{stroke-dasharray:4 5;stroke:var(--muted)}.link.hard path{fill:var(--muted)}
.pill{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;background:var(--panel2);border:1px solid var(--line2);border-radius:10px;padding:7px 10px;max-width:${LINK_W - 8}px}
.pill b{font:500 12px/1.2 var(--mono);color:var(--ink)}.pill i{font:400 11px/1 var(--mono);font-style:normal;color:var(--accent)}
.link.hard .pill i{color:var(--muted)}
.obj{font:400 11.5px/1.35 var(--sans);color:var(--muted);text-align:center;max-width:${LINK_W - 12}px}
.strip{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 22px 16px;margin-top:8px}
.strip .tag{padding-bottom:16px}
.lanes{position:relative;padding-top:6px}
.ruler{position:relative;height:22px;border-bottom:1px solid var(--line2);font:400 11px/1 var(--mono);color:var(--muted)}
.ruler span{position:absolute;bottom:6px;transform:translateX(-50%)}.ruler span::after{content:"";position:absolute;left:50%;bottom:-7px;width:1px;height:5px;background:var(--line2)}
.lane{position:relative}.lane.shots{margin-top:12px}
.blk{position:absolute;height:42px;display:flex;flex-direction:column;justify-content:center;padding:0 10px;overflow:hidden;white-space:nowrap;border-radius:7px;box-shadow:inset 0 0 0 1px #ffffff22}
.blk b{font:500 10.5px/1 var(--mono);opacity:.75}.blk span{font:600 14px/1.2 var(--sans);letter-spacing:-.02em}.blk i{display:none}
.blk:hover i{display:block}
.lane.hand{height:30px;margin-top:6px;border-top:1px solid var(--line)}
.cap{position:absolute;right:0;top:4px;font:400 10px/1 var(--mono);color:#55555c;font-style:normal;text-transform:uppercase;letter-spacing:.08em}
.span{position:absolute;top:6px;height:18px;border-radius:4px;background:repeating-linear-gradient(135deg,#ffffff30 0 4px,transparent 4px 8px);border:1px solid #ffffff66;overflow:hidden}
.span span{position:absolute;left:6px;top:0;font:500 10.5px/16px var(--mono);color:var(--ink);white-space:nowrap}
.dot{position:absolute;top:10px;width:9px;height:9px;margin-left:-4px;transform:rotate(45deg);background:var(--muted)}
.dot span{position:absolute;left:14px;top:-1px;transform:rotate(-45deg);transform-origin:0 50%;font:400 10.5px/9px var(--mono);color:var(--muted);white-space:nowrap}
.overlay{position:absolute;left:0;right:0;top:28px;bottom:0;pointer-events:none}
.cutmark{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed #ffffff40}
.lane.sound{margin-top:6px;border-top:1px solid var(--line)}
.tick{position:absolute;top:0;bottom:0;width:0;border-left:2px solid var(--snd)}
.tick span{position:absolute;left:5px;top:calc(4px + var(--r) * 20px);font:400 11px/16px var(--mono);color:var(--ink2);white-space:nowrap}
.tick span i{font-style:normal;color:var(--snd)}
.bed{position:absolute;bottom:4px;height:6px;border-radius:3px;background:color-mix(in srgb,var(--snd) 40%,transparent)}.bed span{position:absolute;top:8px;left:4px;font:400 10.5px/1 var(--mono);color:var(--muted)}
.spec{position:absolute;top:-6px;bottom:0;width:0;border-left:2px solid var(--spec)}
.spec span{position:absolute;top:-6px;left:-1px;transform:translate(-50%,-100%);font:500 11px/1 var(--mono);color:#111;background:var(--spec);padding:4px 8px;border-radius:99px;white-space:nowrap}
.strip footer{display:flex;gap:18px;margin-top:14px;font:400 11.5px/1 var(--mono);color:var(--muted)}
.key{display:flex;align-items:center;gap:7px}.sw{display:inline-block;width:14px;height:10px;border-radius:2px}
.sw-span{background:repeating-linear-gradient(135deg,#fff8 0 3px,transparent 3px 6px);border:1px solid #fff8}.sw-snd{background:var(--snd);width:3px}.sw-spec{background:var(--spec);width:3px}.sw-cut{width:0;height:12px;border-left:1px dashed #fff8;border-radius:0}
.pass{margin:28px 0 0;max-width:${CARD_W * 2}px;background:color-mix(in srgb,var(--note) 10%,var(--panel));border:1px solid color-mix(in srgb,var(--note) 30%,transparent);border-radius:10px;padding:14px;font:400 13px/1.5 var(--sans);color:var(--ink2)}
.pass .k{display:block;margin-bottom:6px;font:500 10.5px/1 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--note)}
.sticky{position:absolute;width:210px;min-height:120px;background:var(--note);color:#2b2300;border-radius:3px 3px 12px 3px;box-shadow:0 14px 28px -10px #000c,0 1px 0 #fff6 inset;display:flex;flex-direction:column;z-index:5}
.sticky .grip{height:22px;cursor:move;display:flex;justify-content:flex-end;align-items:center;padding:0 6px;background:#00000014}
.sticky .grip button{all:unset;cursor:pointer;font:600 14px/1 var(--mono);padding:2px 6px;color:#2b2300aa}
.sticky .text{flex:1;padding:10px 12px 14px;font:500 15px/1.35 var(--sans);outline:none;white-space:pre-wrap;min-height:90px}
.bar-ui{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;background:#17171af0;border:1px solid var(--line2);backdrop-filter:blur(10px);padding:5px;border-radius:12px;z-index:20;box-shadow:0 14px 34px -12px #000}
.bar-ui button{all:unset;cursor:pointer;font:500 13px/1 var(--mono);color:var(--ink2);padding:9px 12px;border-radius:8px}
.bar-ui button:hover{background:var(--panel2);color:var(--ink)}.bar-ui .pct{min-width:58px;text-align:center;color:var(--muted);font:400 13px/1 var(--mono)}
.bar-ui .sep{width:1px;height:20px;background:var(--line2);margin:0 4px}
.hint{position:fixed;left:22px;top:18px;font:400 12px/1.4 var(--mono);color:var(--muted);z-index:10;pointer-events:none}
#lightbox{position:fixed;inset:0;background:#000d;display:none;align-items:center;justify-content:center;z-index:50;cursor:zoom-out}
#lightbox.on{display:flex}#lightbox img{max-width:94vw;max-height:92vh;border-radius:8px;box-shadow:0 0 0 1px var(--line2)}
`;

/** The storyboard page. `images` maps a shot id to its image path relative to the page; `fontCss` holds the @font-face rules. Pure. */
export function storyboardHtml(board, { images, fontCss = '' }) {
  const perRow = Math.min(PER_ROW, board.shots.length);
  const rowW = perRow * CARD_W + (perRow - 1) * LINK_W;
  const meta = [`<span><b>${sec(board.duration)}</b> &middot; ${board.shots.length} ${L.scenes}</span>`, board.spectacle ? `<span>${L.bigMoment} <b>${board.spectacle.at.toFixed(2)} s</b></span>` : '', board.hasBrief ? '' : '<span>no brief.md: page data only</span>'].join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(board.film)} storyboard</title>
<style>${fontCss}${CSS}</style></head>
<body>
<div id="viewport"><div id="world" data-film="${esc(board.film)}">
  <div class="head"><h1>${esc(board.film)}</h1><div class="meta">${meta}</div>${board.message ? `<p class="msg">${esc(board.message)}</p>` : ''}</div>
  ${planPanel(board.plan)}
  ${rowsOfCards(board, images)}
  ${strip(board, rowW)}
  ${board.motionPass ? `<div class="pass"><span class="k">${L.movementCheck}</span>${esc(board.motionPass)}</div>` : ''}
  <div id="notes"></div>
</div></div>
<div class="hint">drag to pan &middot; wheel or pinch to zoom &middot; + &minus; 0 &middot; F fit &middot; N note &middot; click a frame for full size</div>
<div class="bar-ui"><button id="out" title="zoom out (-)">&minus;</button><span class="pct" id="pct">100%</span><button id="in" title="zoom in (+)">+</button><span class="sep"></span><button id="fit" title="fit to screen (F)">Fit</button><button id="one" title="100% (0)">100%</button><span class="sep"></span><button id="add" title="add a sticky note (N)">+ Note</button></div>
<div id="lightbox"><img alt=""></div>
<script>${storyboardScript}</script>
</body></html>
`;
}
