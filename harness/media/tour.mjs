// `vawe new --from-url <url> --tour steps.json`: drive a scripted cursor through the real page and write an mp4 of it.
// Every frame is made alone, at its exact second: the page clock (core/engine/page-clock.js) owns Date, rAF and timers,
// every CSS and Web Animation is paused and set to the time since it began, the scroll and the cursor are
// pure functions of t (core/motion eases), and the mouse is a real one (CDP Input.dispatchMouseEvent), so :hover styles and
// the page's own handlers run. Frames go through the renderer's own encoder, so there is no screen recording.
// Not frozen: network timing and timers the page set before the first frame. After a click the clock waits for the network to go quiet.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installPageClock } from '../../core/engine/page-clock.js';
import { awaitFonts } from '../../core/engine/page-seek.js';
import { easeFn } from '../../core/motion/presets.js';
import { ffmpegEncode, frameFormat, settle } from './render-page.mjs';
import { frameCount, frameTime, inside, pressedAt, stepsDue, valueAt } from './tour-math.mjs';

const CURSOR_PX_AT_1440 = 22;
const CLICK_QUIET_MS = 400;
const CLICK_WAIT_MS = 10000;
const CLICK_MIN_MS = 1500;
const CURSOR_SVG = '<svg viewBox="3.5 2.2 20 22" width="20" height="22" style="overflow:visible;display:block"><path d="M3.5 2.2v17.6l4.9-4.3 3 6.9 3-1.3-3-6.8h6.6z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
const real = (ms) => new Promise((r) => setTimeout(r, ms));
const cursorEase = easeFn('land');
const scrollEase = easeFn('settle');

// In page. Each animation runs from the second it was first seen: a loop starts at phase 0, a finished one stays finished.
function seekLive(t) {
  window.__pageClock.set(t);
  const seen = window.__tourSeen || (window.__tourSeen = new Map());
  for (const a of document.getAnimations()) {
    if (seen.has(a) || !a.effect) continue;
    const t0 = a.effect.getComputedTiming().endTime === Infinity ? t : t - (a.currentTime || 0) / 1000;
    if (Number.isFinite(t0)) seen.set(a, t0);
  }
  for (const [a, t0] of seen) {
    if (a.playState === 'idle' || (a.effect && a.effect.target && !a.effect.target.isConnected)) seen.delete(a);
    else { a.pause(); a.currentTime = (t - t0) * 1000; }
  }
}

// In page: the cursor is an element of the page, so it is in every screenshot. It is added again if a navigation removed it.
function placeCursor(x, y, scale, svg, px) {
  let el = document.getElementById('__tour-cursor');
  if (!el) {
    el = document.createElement('div');
    el.id = '__tour-cursor';
    el.innerHTML = svg;
    el.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform-origin:0 0;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45));width:${px}px`;
    el.firstChild.setAttribute('width', px);
    el.firstChild.setAttribute('height', px * 1.1);
    document.documentElement.appendChild(el);
  }
  el.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
}

const rectOf = (page, selector) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, pageTop: r.top + scrollY };
}, selector);

const noElement = (step, what) => new Error(`tour: step at ${step.t} s: no element matches ${what}`);

// The middle of an element in viewport coordinates at second `at`, when the scroll has the value it will have then.
async function centreAt(page, step, state, at) {
  const r = await rectOf(page, step.target);
  if (!r) throw noElement(step, step.target);
  return { r, x: r.left + r.width / 2, y: r.pageTop + r.height / 2 - scrollAt(state, at) };
}

const scrollAt = (state, at) => valueAt(state.scrollSegs, at, 0, scrollEase);
const cursorAt = (state, at) => ({ x: valueAt(state.x, at, state.start.x, cursorEase), y: valueAt(state.y, at, state.start.y, cursorEase) });

async function resolveScroll(page, step, state) {
  let to = step.target;
  if (step.kind === 'scrollTo') {
    const r = await rectOf(page, step.target);
    if (!r) throw noElement(step, step.target);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    to = Math.min(max, Math.max(0, r.pageTop - step.offset));
  }
  state.scrollSegs.push({ t0: step.t, dur: step.dur, from: scrollAt(state, step.t), to, selector: step.kind === 'scrollTo' ? step.target : null, offset: step.offset });
}

// A page may lay itself out while it scrolls (content-visibility), so a scrollTo measures its element again on every frame it runs and on the first one after.
async function retarget(page, state, t, frameS) {
  for (const seg of state.scrollSegs) {
    if (!seg.selector || t < seg.t0 || t > seg.t0 + seg.dur + frameS) continue;
    const r = await rectOf(page, seg.selector);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (r) seg.to = Math.min(max, Math.max(0, r.pageTop - seg.offset));
  }
}

async function resolveMove(page, step, state) {
  const from = cursorAt(state, step.t);
  const to = typeof step.target === 'string' ? await centreAt(page, step, state, step.t + step.dur) : { x: step.target[0], y: step.target[1] };
  state.x.push({ t0: step.t, dur: step.dur, from: from.x, to: to.x });
  state.y.push({ t0: step.t, dur: step.dur, from: from.y, to: to.y });
}

async function resolveClick(page, step, state) {
  const here = cursorAt(state, step.t);
  const { r } = await centreAt(page, step, state, step.t);
  const box = { left: r.left, top: r.pageTop - scrollAt(state, step.t), width: r.width, height: r.height };
  if (!inside(here, box)) throw new Error(`tour: click at ${step.t} s on ${step.target}: the cursor is at ${here.x.toFixed(0)},${here.y.toFixed(0)}, outside the element; add a move step that ends before it`);
  state.clicks.push({ t0: step.t });
}

const resolve = (page, step, state) => (step.kind === 'move' ? resolveMove : step.kind === 'click' ? resolveClick : resolveScroll)(page, step, state);

// Mouse buttons and position, as the real CDP events. Returns the new { x, y, down }.
async function driveMouse(page, prev, next) {
  if (next.x !== prev.x || next.y !== prev.y || next.scrolled) await page.mouse.move(next.x, next.y);
  if (next.down && !prev.down) await page.mouse.down();
  if (!next.down && prev.down) await page.mouse.up();
  return { x: next.x, y: next.y, down: next.down };
}

// A click may change the page: wait for the network to go quiet, then start the scroll again from where the new page is.
async function afterClick(page, t, cdp, state) {
  let done = false;
  const began = Date.now();
  const quiet = page.waitForNetworkIdle({ idleTime: CLICK_QUIET_MS, timeout: CLICK_WAIT_MS }).catch(() => {}).then(() => { done = true; });
  while (!done || Date.now() - began < CLICK_MIN_MS) {
    await page.evaluate((s) => window.__pageClock && window.__pageClock.set(s), t).catch(() => {});
    await real(80);
  }
  await quiet;
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  const y = await page.evaluate(() => window.scrollY);
  state.scrollSegs = [{ t0: t, dur: 0, from: y, to: y }];
}

async function freeze(page) {
  const cdp = await page.createCDPSession();
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  return cdp;
}

async function prepare(page) {
  await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const install = `(${installPageClock})();window.__pageFonts = ${awaitFonts};`;
  await page.evaluateOnNewDocument(install);
  await page.evaluate(install);
  return freeze(page);
}

/** Capture every frame of the tour into tmpDir as f000000.ext, ...: returns the frame count. */
export async function captureTour(page, tour, { fps, tmpDir, width }) {
  const cdp = await prepare(page);
  const frames = frameCount(tour.dur, fps);
  const size = Math.round(CURSOR_PX_AT_1440 * (width / 1440));
  const start = tour.cursor ? { x: tour.cursor[0], y: tour.cursor[1] } : { x: page.viewport().width / 2, y: page.viewport().height / 2 };
  const state = { start, x: [], y: [], scrollSegs: [], clicks: [] };
  const format = frameFormat(true);
  let mouse = { x: -1, y: -1, down: false };
  let prev = -Infinity;
  for (let i = 0; i < frames; i++) {
    const t = frameTime(i, fps);
    for (const step of stepsDue(tour.steps, prev, t)) await resolve(page, step, state);
    prev = t;
    await retarget(page, state, t, 1 / fps);
    const scrollY = scrollAt(state, t);
    const now = { ...cursorAt(state, t), down: pressedAt(state.clicks, t) };
    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
    const released = mouse.down && !now.down;
    mouse = await driveMouse(page, mouse, { ...now, scrolled: Math.abs(before - scrollY) > 0.01 });
    if (released) await afterClick(page, t, cdp, state);
    await page.evaluate(placeCursor, now.x, now.y, now.down ? 0.88 : 1, CURSOR_SVG, size);
    await page.evaluate(seekLive, t);
    await settle(page);
    fs.writeFileSync(path.join(tmpDir, `f${String(i).padStart(6, '0')}.${format.ext}`), await page.screenshot(format.shot));
  }
  return frames;
}

/** Encode the captured frames to an mp4 with the renderer's own encoder (one frame per output frame, no blend). */
export function encodeTour(tmpDir, frames, fps, outFile) {
  const kArr = Array(frames).fill(1);
  const starts = Array.from({ length: frames + 1 }, (_, i) => i);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const r = ffmpegEncode(tmpDir, fps, kArr, starts, outFile, { final: true });
  if (r.status !== 0 || !fs.existsSync(outFile)) throw new Error(`tour: ffmpeg encode failed (exit ${r.status}):\n${(r.stderr || '').trim().slice(0, 600)}`);
}

export const tourTmpDir = () => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'vawe-tour-'));
