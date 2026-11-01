// Element bounding boxes over film time, read with the page's own seek and no screenshots. One sampler
// serves the render's speed pass (the animated targets) and the motion lint of a page that paints in
// window.seek or vawe.onFrame (every element). A box is [x, y, w, h, opacity, own opacity]; the two
// opacities are only read for 'visible', where opacity is the product up the ancestor chain. An 'animated'
// box also carries its turn and inset() clip (harness/lib/edge-travel.mjs), then the loop count of the
// animations on it and its ancestors.

import { turnAndClip } from './edge-travel.mjs';

// Runs inside the page (page.evaluate serialises it), so it references nothing outside its own body.
export async function trackBoxes(times, scope) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'AUDIO', 'VIDEO', 'SOURCE', 'META', 'LINK', 'TEMPLATE', 'BR', 'TITLE', 'HEAD']);
  const MAX_ELEMENTS = 300;
  const found = scope.selectors ? scope.selectors.map((s) => document.querySelector(s)) : null;
  const els = found ? found.filter(Boolean) : scope === 'animated'
    ? [...new Set(document.getAnimations().map((a) => a.effect && a.effect.target).filter((t) => t && t.getBoundingClientRect))]
    : [...document.body.querySelectorAll('*')].filter((el) => !SKIP.has(el.tagName) && !el.closest('svg defs, svg mask, svg clipPath')).slice(0, MAX_ELEMENTS);
  const index = new Map(els.map((el, i) => [el, i]));
  const parentOf = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (index.has(p)) return index.get(p); return -1; };
  const own = (el) => { const cs = getComputedStyle(el); return cs.visibility === 'hidden' || cs.display === 'none' ? 0 : Number(cs.opacity); };
  const alpha = (el) => { let o = 1; for (let p = el; p && p.nodeType === 1 && o > 0; p = p.parentElement) o *= own(p); return o; };
  const tracks = els.map(() => []);
  const loopsOf = (el) => {
    let n = 0;
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) for (const a of p.getAnimations()) n += a.effect.getComputedTiming().currentIteration || 0;
    return n;
  };
  for (const t of times) {
    await window.__pageSeek(t, window, scope !== 'animated');
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      tracks[i].push(scope === 'animated' ? [r.x, r.y, r.width, r.height, ...window.__turnAndClip(el, r), loopsOf(el)] : [r.x, r.y, r.width, r.height, alpha(el), own(el)]);
    });
  }
  const label = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '';
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : cls}${text ? ` "${text}"` : ''}`;
  };
  return {
    times, tracks, labels: els.map(label), parent: els.map(parentOf),
    area: innerWidth * innerHeight, width: innerWidth, height: innerHeight,
    canvas: document.querySelectorAll('canvas').length,
    matched: found ? found.map((el) => (el ? els.indexOf(el) : -1)) : undefined,
  };
}

/** Box tracks at `times` (seconds) for 'animated' (animation targets), 'visible' (every element) or { selectors } (the first match of each; `matched` gives its track). */
export async function sampleBoxTracks(page, times, scope) {
  await page.evaluate(`window.__turnAndClip = ${turnAndClip}`);
  return page.evaluate(trackBoxes, times, scope);
}

/** Per step, the largest move or resize of any element between two samples, in CSS px. */
export function maxStepDeltas(tracks, steps = Math.max(0, ...tracks.map((t) => t.length)) - 1) {
  const out = [];
  for (let k = 1; k <= steps; k++) {
    let d = 0;
    for (const t of tracks) {
      const a = t[k], b = t[k - 1];
      if (a && b) d = Math.max(d, Math.hypot(a[0] - b[0], a[1] - b[1]), Math.abs(a[2] - b[2]), Math.abs(a[3] - b[3]));
    }
    out.push(d);
  }
  return out;
}

/** Sample times for the motion lint: 60 a second, at most `max` samples, from 0 to `dur`. */
export function lintTimes(dur, max = 300) {
  const step = Math.max(1 / 60, dur / max);
  const n = Math.floor(dur / step + 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => +(i * step).toFixed(4));
}
