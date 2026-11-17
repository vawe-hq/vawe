// A live hold: one part of the frame moves while the rest rests (rule live-hold). Each helper is a Web Animation, so the seek owns its time.
import { EASE } from './presets.js';

const ms = (s) => Math.round(s * 1000);

/** The keyframes and timing of a breath: the part grows by `scale` and brightens by `glow`, then returns, `dur` seconds from `at`. Pure. */
export function breatheSpecs({ at = 0, dur = 2, period = 1.6, scale = 0.06, glow = 0.25 } = {}) {
  const frames = [
    { scale: 1, filter: 'brightness(1)', easing: EASE.glide },
    { scale: 1 + scale, filter: `brightness(${1 + glow})`, easing: EASE.glide },
    { scale: 1, filter: 'brightness(1)' },
  ];
  return { frames, timing: { delay: ms(at), duration: ms(period), iterations: Math.max(1, dur / period), fill: 'both' } };
}

/** The part breathes for `dur` seconds from `at`: for a mark, a button, a rule or a shape that the hold should keep alive. */
export function breathe(el, opts) {
  const { frames, timing } = breatheSpecs(opts);
  return el.animate(frames, timing);
}

/** A bright band sweeping across the part, `dur` seconds from `at`: it adds one overlay child, so the part needs a box and clips it. */
export function glint(el, { at = 0, dur = 1, tint = 'rgba(255,255,255,0.55)' } = {}) {
  el.style.position ||= 'relative';
  el.style.overflow = 'hidden';
  const band = el.ownerDocument.createElement('i');
  band.setAttribute('aria-hidden', 'true');
  band.style.cssText = `position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 35%,${tint} 50%,transparent 65%)`;
  el.append(band);
  return band.animate([{ translate: '-100% 0' }, { translate: '100% 0' }], { delay: ms(at), duration: ms(dur), easing: EASE.glide, fill: 'both' });
}
