// harness/media/preview-server.mjs: a small local process that keeps ONE browser open across calls, so
// a fast check (--look/--dom/--probe/--layout in see.mjs, and a windowed draft in render-page.mjs)
// skips Chrome's cold start on every run. Measured cost this exists for: "each fast check reopens the
// browser and page" (see.mjs's own doc comment). It starts itself on the first call that wants it and
// exits on its own after 10 idle minutes, checked against this file's own mtime (bumped on every use and
// every 30 s while a client process holds a page here), or at once when its checkout no longer exists.
// If it is not running, or anything about starting or reaching it fails,
// `openPreview` falls back to a plain serveRepo+launchPage per call, exactly like before this file
// existed: this is an optimization, never a second way to load a page.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scratch } from '../lib/scratch.mjs';
import { serveRepo, launchPage, trackBrowser, insideRoot, REPO_ROOT, pageArgs, PROTOCOL_TIMEOUT_MS } from '../lib/render-harness.mjs';
import { pageQuery } from '../lib/page-params.mjs';

const SELF = fileURLToPath(import.meta.url);
// One daemon per checkout and capture mode (a draft and a final need different browser flags): a shared state file made a worktree render pages from another checkout's root.
export const stateFile = (final) => scratch('preview-server', `${createHash('sha1').update(REPO_ROOT).digest('hex').slice(0, 10)}${final ? '' : '-draft'}.json`);
/** Chrome's own output and its disconnects, for a verb that lost the browser. */
export const browserLog = (final) => stateFile(final).replace(/\.json$/, '.log');
const LOG_MAX_BYTES = 2 * 1024 * 1024;

function openBrowserLog(final) {
  const file = browserLog(final);
  if (fs.existsSync(file) && fs.statSync(file).size > LOG_MAX_BYTES) fs.renameSync(file, `${file}.1`);
  return fs.openSync(file, 'a');
}
const idleMs = () => Number(process.env.VAWE_PREVIEW_IDLE_MS) || 10 * 60 * 1000;
const checkEveryMs = () => Math.min(30000, idleMs() / 3);

/** Whether a daemon quits: its state file was last touched more than `idleMs` ago, or its checkout is gone. */
export const shouldExit = ({ touchedMs, nowMs, idleMs, rootExists }) => !rootExists || nowMs - touchedMs > idleMs;

function readState(final) {
  try { return JSON.parse(fs.readFileSync(stateFile(final), 'utf8')); } catch { return null; }
}
function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function touch(final) {
  try { const now = new Date(); fs.utimesSync(stateFile(final), now, now); } catch { /* daemon exits on its own next idle check */ }
}

// A client keeps the daemon alive while it holds a page here. A tab left behind by a client that died is never touched, so it does not.
function holdAlive(final) {
  const timer = setInterval(() => touch(final), checkEveryMs());
  timer.unref();
  return () => clearInterval(timer);
}

function waitForState(final, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function tick() {
      const s = readState(final);
      if (s && s.wsEndpoint) return resolve(s);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 100);
    })();
  });
}

async function connectShared(final) {
  let state = readState(final);
  const started = !state || !pidAlive(state.pid);
  if (started) {
    try {
      const log = openBrowserLog(final);
      try { spawn(process.execPath, [SELF, '--daemon', ...(final ? [] : ['--draft'])], { detached: true, stdio: ['ignore', log, log] }).unref(); }
      finally { fs.closeSync(log); }
    } catch { return null; }
    state = await waitForState(final, 5000);
    if (!state) return null;
  }
  try {
    const { default: puppeteer } = await import('puppeteer');
    // Puppeteer's default viewport (800x600) is applied to every page a client attaches to, including another process's tab.
    const browser = await puppeteer.connect({ browserWSEndpoint: state.wsEndpoint, protocolTimeout: PROTOCOL_TIMEOUT_MS, defaultViewport: null });
    touch(final);
    return { browser, port: state.port, started };
  } catch { return null; }
}

// The top level of the checkout a page lives in (its own folder when it is in none). Only `vawe new --from-url` serves from it,
// so a shot sees the page's own core/; still and dev serve the page with pageMount, so they see this checkout's.
export function pageRoot(abs) {
  const dir = path.dirname(abs);
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || dir;
  } catch { return dir; }
}

/**
 * How a page outside this checkout is served: { prefix, dir, url }, the URL folder the page keeps, the real folder behind it and the page's URL path.
 * A page in a git checkout keeps its path in that checkout, so its `../../core/` is this checkout's core/; a page in no repo is served at the root of its own folder.
 */
export function pageMount(abs) {
  const real = fs.realpathSync(abs);
  const dir = path.dirname(real);
  let top = null;
  try { top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { /* no repo */ }
  const prefix = top ? path.relative(top, dir).split(path.sep).join('/') : '';
  return { prefix, dir, url: `${prefix ? `${prefix}/` : ''}${path.basename(real)}` };
}

// Size and mtime of every file under the dirs (any edit to the page folder or to core/ changes it), or with
// `content` the bytes of each file: a checkout, rebase or touch then leaves it alone.
export function treeSignature(dirs, { content = false } = {}) {
  const h = createHash('sha1');
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (content) h.update(`${p}:`).update(fs.readFileSync(p)).update(';');
      else { const st = fs.statSync(p); h.update(`${p}:${st.size}:${st.mtimeMs};`); }
    }
  };
  for (const d of dirs) if (fs.existsSync(d)) walk(d);
  return h.digest('hex');
}

const WARM_TABS = 3;
export const WARM_HASH = '#vawe-warm';

// A warm tab is one this function left open on a page url ending in WARM_HASH, marked with
// window.__warmSig. A tab whose signature is stale reloads; the oldest tabs past WARM_TABS close.
// A process owns the tab it holds in window.__warmOwner (its pid): nothing else reuses or closes it until
// the owner releases it or dies. Two processes on one browser closed each other's tab mid-read.
// A tab with no __warmSig is still loading and belongs to nobody yet.
// Never browser.pages(): it attaches a page (and puppeteer's 800x600 default viewport) to every tab,
// including another process's render tab mid-capture, which then shoots frames laid out at the wrong size.
async function claimWarm(page) {
  try {
    const owner = await page.evaluate(() => window.__warmOwner ?? null);
    if (owner && pidAlive(owner)) return false;
    return await page.evaluate((old, pid) => {
      if (window.__warmSig === undefined || (window.__warmOwner ?? null) !== old) return false;
      window.__warmOwner = pid;
      return true;
    }, owner, process.pid);
  } catch { return false; }
}

// A tab that is still loading throws on url(): it is not reusable yet.
const urlOf = (page) => { try { return page.url(); } catch { return null; } };

export async function takeWarmPage(browser, url, sig) {
  const tabs = browser.targets().filter((t) => t.type() === 'page' && t.url().endsWith(WARM_HASH));
  const warm = (await Promise.all(tabs.map((t) => t.page().catch(() => null)))).filter(Boolean);
  for (const p of warm.slice(0, Math.max(0, warm.length - WARM_TABS + 1))) if (urlOf(p) !== url && await claimWarm(p)) await p.close().catch(() => {});
  for (const p of warm.filter((w) => !w.isClosed() && urlOf(w) === url)) {
    if (!(await claimWarm(p))) continue;
    if ((await p.evaluate(() => window.__warmSig).catch(() => null)) === sig) return { page: p, reused: true };
    await p.close().catch(() => {});
  }
  return { page: await browser.newPage(), reused: false };
}

/**
 * openPreview(pagePath, { width, height, scale, args }) -> { page, url, persistent, close }.
 * width/height are the CSS viewport; scale is the device scale a screenshot is taken at.
 * With `warm`, the page stays open after close() and the next call on the same url and unchanged files
 * gets it back with `reused: true`; the caller runs `markWarm()` once the page has loaded.
 * `url` is already the right one to `page.goto()`: relative to the shared daemon's REPO_ROOT server
 * when the shared browser is live and `pagePath` is inside the repo, a fresh per-call server otherwise
 * (a scratch/tmp fixture outside the repo, or the daemon not running). `close()` releases only what
 * THIS call opened: its own page when persistent, the whole server+browser otherwise. `final` (default
 * true) picks the browser flags (pageArgs) and the daemon: a draft render passes false.
 */
export async function openPreview(pagePath, { width = 1920, height = 1080, scale = 1, final = true, warm = false, frameKey = '' } = {}) {
  const abs = path.resolve(pagePath);
  if (insideRoot(REPO_ROOT, abs)) {
    const shared = await connectShared(final);
    if (shared) {
      const url = `http://127.0.0.1:${shared.port}/${path.relative(REPO_ROOT, abs)}${pageQuery()}${warm ? WARM_HASH : ''}`;
      const sig = warm ? treeSignature([path.dirname(abs), path.join(REPO_ROOT, 'core')]) + frameKey : '';
      const { page, reused } = warm ? await takeWarmPage(shared.browser, url, sig) : { page: await shared.browser.newPage(), reused: false };
      await page.setViewport({ width, height, deviceScaleFactor: scale });
      const release = holdAlive(final);
      if (warm) {
        let marked = reused;
        const markWarm = async () => { await page.evaluate((v, pid) => { window.__warmSig = v; window.__warmOwner = pid; }, sig, process.pid); marked = true; };
        const close = async () => {
          release();
          await (marked ? page.evaluate(() => { window.__warmOwner = null; }) : page.close()).catch(() => {});
          shared.browser.disconnect();
        };
        return { page, url, persistent: true, chrome: shared.started ? 'launched' : 'reused', reused, markWarm, close };
      }
      // `disconnect()`, never `close()`: this call's own CDP connection to the shared browser, not the
      // browser itself. Closing only the page and never disconnecting left the connection's open socket
      // holding the process alive well past the render finishing (a real hang this file was measured
      // against: a windowed draft's own log line printed, then nothing exited for ~30s).
      return { page, url, persistent: true, chrome: shared.started ? 'launched' : 'reused', close: async () => { release(); await page.close().catch(() => {}); shared.browser.disconnect(); } };
    }
  }
  const mount = pageMount(abs);
  const { close: closeServer, port } = await serveRepo({ root: REPO_ROOT, mounts: [mount] });
  const { page, close: closePage } = await launchPage({ width, height, scale, args: pageArgs(final) });
  const url = `http://127.0.0.1:${port}/${mount.url}${pageQuery()}`;
  return { page, url, persistent: false, chrome: 'launched', close: async () => { await closePage(); closeServer(); } };
}

/** Whether this process is the one daemon of its state file: clients that find no state all start a daemon at once, and only the first may stay. */
function claimDaemon(final) {
  const lock = `${stateFile(final)}.lock`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); return lock; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let holder;
      try { holder = Number(fs.readFileSync(lock, 'utf8')); } catch (r) { if (r.code === 'ENOENT') continue; throw r; }
      if (holder !== process.pid && pidAlive(holder)) return null;
      fs.rmSync(lock, { force: true });
    }
  }
  return null;
}

async function daemonMain(final) {
  const lock = claimDaemon(final);
  if (!lock) return process.exit(0);
  const { default: puppeteer } = await import('puppeteer');
  const { close: closeServer, port } = await serveRepo({ root: REPO_ROOT });
  const browser = trackBrowser(await puppeteer.launch({ headless: true, args: pageArgs(final), protocolTimeout: PROTOCOL_TIMEOUT_MS, dumpio: true }));
  browser.on('disconnected', () => console.error(`${new Date().toISOString()} chrome disconnected (pid ${browser.process()?.pid ?? '?'})`));
  fs.writeFileSync(stateFile(final), JSON.stringify({ pid: process.pid, port, wsEndpoint: browser.wsEndpoint() }));

  const shutdown = async () => {
    clearInterval(idleTimer);
    try { await browser.close(); } catch { /* already gone */ }
    closeServer();
    if (readState(final)?.pid === process.pid) fs.rmSync(stateFile(final), { force: true });
    try { if (Number(fs.readFileSync(lock, 'utf8')) === process.pid) fs.rmSync(lock, { force: true }); } catch { /* the lock is gone already */ }
    process.exit(0);
  };
  const idleTimer = setInterval(() => {
    if (readState(final)?.pid !== process.pid) return shutdown();
    let mtime = 0;
    try { mtime = fs.statSync(stateFile(final)).mtimeMs; } catch { return shutdown(); }
    if (shouldExit({ touchedMs: mtime, nowMs: Date.now(), idleMs: idleMs(), rootExists: fs.existsSync(REPO_ROOT) })) shutdown();
  }, checkEveryMs());
}

if (process.argv.includes('--daemon')) daemonMain(!process.argv.includes('--draft'));
