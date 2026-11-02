// core/engine/page-seek.js: the one in-page seek a bare HTML page runs under, and the frame facts it
// lays out against. harness/media/render-page.mjs injects both with evaluateOnNewDocument (their source,
// via toString(), so neither may reference anything outside its own body); the studio imports them and
// calls seekTo(t, iframe.contentWindow), so a scrub and a render can never disagree about what time t means.

// Seek film time `t` (seconds): set the virtual clock, call window.seek(t) when the page paints as a
// function of time, seek every CSS/WAAPI/SMIL animation, then call every vawe.onFrame hook (awaited, so a
// hook that decodes a texture or builds three.js geometry settles before a screenshot, when it returns a Promise).
// With `layout` set, window.__layoutSeek is true while the hooks run: a pixel-only draw (core/surfaces/lens.js) skips itself, since a probe that reads boxes and text never sees pixels.
export async function seekTo(t, win = window, layout = false) {
  win.__layoutSeek = layout;
  try {
    // A GSAP timeline has a then() that never settles, so only a native Promise is awaited; any other return value is ignored.
    const settle = async (result) => { if (Object.prototype.toString.call(result) === '[object Promise]') await result; };
    if (win.__pageReady) await win.__pageReady();
    if (win.__pageFonts) await win.__pageFonts();
    if (win.__pageClock) win.__pageClock.set(t);
    if (typeof win.seek === 'function') await settle(win.seek(t));
    if (win.__pageFonts) await win.__pageFonts();
    const seen = win.__seekAnimations || (win.__seekAnimations = new Set());
    // getAnimations() drops a finished fill:none animation, so a later seek back would miss it.
    for (const a of win.document.getAnimations()) seen.add(a);
    for (const a of seen) {
      if (a.playState === 'idle' || !a.effect?.target?.isConnected) seen.delete(a);
      else { a.pause(); a.currentTime = t * 1000; }
    }
    win.document.querySelectorAll('svg').forEach((svg) => {
      if (typeof svg.pauseAnimations === 'function') { try { svg.pauseAnimations(); svg.setCurrentTime(t); } catch { /* best-effort */ } }
    });
    for (const fn of win.__vaweFrameHooks || []) await settle(fn(t));
  } finally { win.__layoutSeek = false; }
}

// Resolve when every FontFace in document.fonts has finished loading, including faces whose load starts
// while waiting. A face still loading after `timeoutMs` rejects naming its family. The real timer is used
// because the virtual clock owns setTimeout. Injected via toString(), so it references nothing outside its body.
export async function awaitFonts(timeoutMs = 10000) {
  const fonts = document.fonts;
  const setReal = window.__pageClock ? window.__pageClock.real.setTimeout : setTimeout.bind(window);
  const clearReal = window.__pageClock ? window.__pageClock.real.clearTimeout : clearTimeout.bind(window);
  const deadline = Date.now() + timeoutMs;
  const loadingNow = () => [...fonts].filter((f) => f.status === 'loading');
  for (;;) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setReal(() => reject(new Error(`font still loading after ${timeoutMs} ms: ${loadingNow().map((f) => f.family).join(', ')}`)), Math.max(0, deadline - Date.now()));
    });
    // fonts.ready itself never resolves while a face's file never arrives, so it races the deadline too.
    const loaded = (async () => {
      await fonts.ready;
      const loading = loadingNow();
      await Promise.all(loading.map((f) => f.loaded.catch(() => { throw new Error(`font failed to load: ${f.family}`); })));
      return loading.length === 0;
    })();
    loaded.catch(() => {});
    let done;
    try { done = await Promise.race([loaded, timeout]); } finally { clearReal(timer); }
    if (done) return;
  }
}

// Runs in the page before any page script: lists the async work a page starts that a module-level `await` can wait on (an image
// decode or load, a font load, a fetch and the reading of its body), so awaitReady can tell a page that is still starting from a finished one.
// Injected via toString(), so it references nothing outside its body.
export function installPageReady() {
  if (window.__pagePending) return;
  const open = new Map();
  let ids = 0;
  const track = (what, promise) => {
    const id = ++ids;
    open.set(id, what);
    const done = () => open.delete(id);
    promise.then(done, done);
    return promise;
  };
  const decode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = function trackedDecode() { return track(`image ${this.src}`, decode.call(this)); };
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    ...src,
    set(value) {
      src.set.call(this, value);
      if (!value || this.complete) return;
      track(`image ${this.src}`, new Promise((resolve) => { this.addEventListener('load', resolve, { once: true }); this.addEventListener('error', resolve, { once: true }); }));
    },
  });
  const faceLoad = FontFace.prototype.load;
  FontFace.prototype.load = function trackedLoad() { return track(`font ${this.family}`, faceLoad.call(this)); };
  const fontSet = Object.getPrototypeOf(document.fonts);
  const setLoad = fontSet.load;
  fontSet.load = function trackedSetLoad(font, text) { return track(`font ${font}`, setLoad.call(this, font, text)); };
  const fetchNow = window.fetch;
  window.fetch = (input, init) => track(`fetch ${input?.url ?? input}`, fetchNow(input, init));
  for (const read of ['arrayBuffer', 'blob', 'json', 'text']) {
    const original = Response.prototype[read];
    Response.prototype[read] = function trackedRead() { return track(`${read} of ${this.url}`, original.call(this)); };
  }
  window.__pagePending = () => [...open.values()];
}

// Resolve when the page has started nothing that is still running: no tracked decode, load or fetch, and a real timer tick later
// still none (a module that awaited one continues in a microtask and may start the next). The first resolve is kept, so a seek
// pays for it once. Rejects naming what is pending after `timeoutMs`. Injected via toString(), so it references nothing outside its body.
export async function awaitReady(timeoutMs = 10000) {
  if (window.__pageReadyDone) return;
  const pending = window.__pagePending || (() => []);
  const setReal = window.__pageClock ? window.__pageClock.real.setTimeout : setTimeout.bind(window);
  const tick = (ms) => new Promise((resolve) => setReal(resolve, ms));
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (pending().length === 0) {
      await tick(0);
      if (pending().length === 0) break;
    } else await tick(10);
    if (Date.now() > deadline) throw new Error(`page not ready after ${timeoutMs} ms: still waiting on ${[...new Set(pending())].join(', ')}; a module-level await must finish, or move it into the hook`);
  }
  window.__pageReadyDone = true;
}

// Runs in the page before any page script: the frame facts a page lays out against. documentElement does not exist yet at this point, so its attributes wait for the parser.
export function installPageFrame({ aspect, width, height, eases = {}, duration }) {
  const vawe = window.vawe || (window.vawe = {});
  Object.assign(vawe, { aspect, width, height });
  vawe.onFrame = (fn) => (window.__vaweFrameHooks || (window.__vaweFrameHooks = [])).push(fn);
  Object.defineProperty(vawe, 'fps', {
    configurable: true,
    get() { const m = document.querySelector('meta[name="fps"]'); return m ? Number(m.content) : undefined; },
  });
  Object.defineProperty(vawe, 'layoutSeek', { configurable: true, get: () => Boolean(window.__layoutSeek) });
  // An auto page measured for its length gets 0, so an animation sized from vawe.duration has no end; the render passes the measured length.
  // An infinite animation has no end, so it never sets the end of an auto page.
  vawe.animationEnd = () => {
    const ends = document.getAnimations().map((a) => a.effect?.getComputedTiming().endTime ?? 0);
    return { endS: Math.max(0, ...ends.filter(Number.isFinite)) / 1000, infinite: ends.includes(Infinity) };
  };
  Object.defineProperty(vawe, 'duration', {
    configurable: true,
    get() {
      const m = document.querySelector('meta[name="duration"]');
      if (!m) return undefined;
      return m.content.trim() === 'auto' ? duration ?? 0 : Number(m.content);
    },
  });
  const apply = () => {
    const root = document.documentElement;
    root.dataset.aspect = aspect;
    root.style.setProperty('--vw', `${width}px`);
    root.style.setProperty('--vh', `${height}px`);
    for (const [name, curve] of Object.entries(eases)) root.style.setProperty(`--ease-${name}`, curve);
  };
  if (document.documentElement) { apply(); return; }
  new MutationObserver((_, obs) => { if (document.documentElement) { obs.disconnect(); apply(); } })
    .observe(document, { childList: true });
}
