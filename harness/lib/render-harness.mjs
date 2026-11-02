import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// The union of every table the 22 copies carried; a narrower table served a real file as application/octet-stream, which is how a .mp4 or an .otf silently failed to play or load.
export const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

// Every copy wrote `p.startsWith(root)`, which also accepts a SIBLING whose name merely begins with the root's (/repo passes for /repo-evil); path.relative answers the question that was meant: is p at or below root.
export function insideRoot(root, p) {
  const rel = path.relative(root, p);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

const isFile = (p) => fs.existsSync(p) && !fs.statSync(p).isDirectory();

/** The file a request path is served from, or null: a mount's folder first when the path is under its prefix, then `root`. */
export function servedFile(root, mounts, rel) {
  for (const { prefix, dir } of mounts) {
    const inner = prefix === '' ? rel : rel.startsWith(`${prefix}/`) ? rel.slice(prefix.length + 1) : null;
    const p = inner === null ? null : path.join(dir, inner);
    if (p && insideRoot(dir, p) && isFile(p)) return p;
  }
  const p = path.join(root, rel);
  return insideRoot(root, p) && isFile(p) ? p : null;
}

/**
 * serveRepo({ root, port, route, mounts }) → { server, port, close }
 * A static file server over `root`, bound to 127.0.0.1. `port` 0 (the default) takes any free port.
 * `route(req, res)` is the hook for a virtual path a caller serves from memory: return true when it
 * answered the request, anything falsy to fall through to the static handler.
 * `mounts` is a list of { prefix, dir }: a path under `prefix` (any path when it is '') is read from `dir` when the file is there,
 * so a page outside `root` keeps its own files beside root's core/ and assets/.
 */
// Any site open in the person's browser can reach 127.0.0.1: through DNS rebinding (a foreign Host)
// or a cross-site POST, which browsers send with no preflight (a foreign Origin).
export function localRequest(req, port) {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!hosts.includes(req.headers.host)) return false;
  const origin = req.headers.origin;
  return origin === undefined || hosts.some((h) => origin === `http://${h}`);
}

export async function serveRepo({ root = REPO_ROOT, port = 0, route = null, mounts = [] } = {}) {
  const server = http.createServer((req, res) => {
    if (!localRequest(req, server.address().port)) { res.writeHead(403); return res.end(); }
    if (route && route(req, res)) return;
    let rel;
    try { rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); } catch { res.writeHead(400); return res.end(); }
    const p = servedFile(root, mounts, rel);
    if (!p) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  return { server, port: server.address().port, close: () => server.close() };
}

// Chrome's sandbox cannot start on Linux CI runners and containers (user namespaces are blocked); everywhere else it stays on, because `new --from-url` opens untrusted sites.
export const SANDBOX_ARGS = process.platform === 'linux' ? ['--no-sandbox'] : [];

// The flags a deterministic capture needs: no scrollbars over the canvas, and a device scale the caller owns rather than the host's display.
export const RENDER_ARGS = [...SANDBOX_ARGS, '--hide-scrollbars', '--force-device-scale-factor=1'];

// A final keeps GPU compositing off: ~150+ rapid seek+screenshot round trips crashed the GPU compositor
// there, and its pixels must not depend on the GPU. A draft composites on the GPU (1.5x faster at half
// size) and its pixels differ from a final's by about 44 dB PSNR. `--disable-gpu` (broader) would make
// WebGL context creation fail.
export const pageArgs = (final) => (final ? [...RENDER_ARGS, '--disable-gpu-compositing'] : RENDER_ARGS);

// A time-capped scene command (`perl -e 'alarm ...' exec`) SIGTERMs this process and leaves Chrome
// behind, because puppeteer's browser.close() runs on the way out only if something calls it; a killed
// node process never gets there. Tracked here once, so every caller that launches through this file (or
// registers its own puppeteer.launch() with trackBrowser) gets the close for free instead of each one
// re-inventing its own signal handler.
const liveBrowsers = new Set();
let handlersInstalled = false;

// A SIGKILLed node process runs no handler at all, so every launched Chrome is also written to this directory
// (file name = Chrome pid, content = owner pid); the next render to start kills the Chromes whose owner is dead.
const CHROME_DIR = path.join(os.tmpdir(), 'vawe-chrome');
const CLOSE_GRACE_MS = 5000;
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const killGroup = (pid) => { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } } };

// A Chrome launched by code that never registered it (an older checkout, a bare puppeteer.launch) is
// adopted by init (ppid 1) when its node process dies; puppeteer's own Chrome always has a node parent.
export function unownedChromePids(psText) {
  return psText.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .filter(([, , ppid, command]) => ppid === '1' && /puppeteer_dev_chrome_profile/.test(command) && !/--type=/.test(command))
    .map(([, pid]) => Number(pid));
}

export function reapOrphanBrowsers(dir = CHROME_DIR, psText = spawnSync('ps', ['-axww', '-o', 'pid=,ppid=,command='], { encoding: 'utf8' }).stdout || '') {
  let reaped = 0;
  for (const pid of unownedChromePids(psText)) { killGroup(pid); reaped++; }
  if (!fs.existsSync(dir)) return reaped;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const owner = Number(fs.readFileSync(file, 'utf8'));
    if (pidAlive(owner)) continue;
    const command = spawnSync('ps', ['-p', name, '-o', 'command='], { encoding: 'utf8' }).stdout;
    if (/puppeteer_dev_chrome_profile/.test(command)) { killGroup(Number(name)); reaped++; }
    fs.rmSync(file, { force: true });
  }
  return reaped;
}

function registerBrowser(browser, dir = CHROME_DIR) {
  const pid = browser.process()?.pid;
  if (!pid) return () => {};
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, String(pid));
  fs.writeFileSync(file, String(process.pid));
  return () => fs.rmSync(file, { force: true });
}

function installCleanupHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;
  const closeAll = async () => {
    const browsers = [...liveBrowsers];
    liveBrowsers.clear();
    for (const b of browsers) {
      const closed = await Promise.race([b.close().then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), CLOSE_GRACE_MS))]);
      if (!closed) { const pid = b.process()?.pid; if (pid) killGroup(pid); }
    }
  };
  process.on('exit', () => { for (const b of liveBrowsers) { const pid = b.process()?.pid; if (pid) killGroup(pid); } });
  reapOrphanBrowsers();
  for (const [sig, code] of [['SIGTERM', 143], ['SIGINT', 130], ['SIGALRM', 143], ['SIGHUP', 129]]) {
    process.on(sig, async () => { await closeAll(); process.exit(code); });
  }
  process.on('uncaughtException', async (e) => { await closeAll(); console.error(e); process.exit(1); });
  process.on('unhandledRejection', async (e) => { await closeAll(); console.error(e); process.exit(1); });
}

/**
 * trackBrowser(browser) → browser, registered so a SIGTERM/SIGINT/SIGALRM or an uncaught error closes
 * it before this process exits. Idempotent to call more than once per process. Use this directly for a
 * puppeteer.launch() call that bypasses launchPage below (scene-snap.mjs, snap-scenes.mjs: both need a
 * fresh, non-default launch() of their own).
 */
export function trackBrowser(browser) {
  installCleanupHandlers();
  liveBrowsers.add(browser);
  const unregister = registerBrowser(browser);
  const origClose = browser.close.bind(browser);
  browser.close = async (...a) => { liveBrowsers.delete(browser); try { return await origClose(...a); } finally { unregister(); } };
  return browser;
}

// Puppeteer's default is 180 s per protocol call; a heavy WebGL frame late in a long render can exceed it.
export const PROTOCOL_TIMEOUT_MS = 30 * 60 * 1000;

// Puppeteer finds .puppeteerrc.cjs only from the working directory up, and a render may run from a temp dir; without the pin it wants its own older Chrome.
export async function loadPuppeteer() {
  const pin = createRequire(import.meta.url)(path.join(REPO_ROOT, '.puppeteerrc.cjs'));
  process.env.PUPPETEER_CHROME_VERSION ??= pin.chrome.version;
  process.env.PUPPETEER_CHROME_HEADLESS_SHELL_VERSION ??= pin['chrome-headless-shell'].version;
  return (await import('puppeteer')).default;
}

/** launchPage({ width, height, scale, args }) → { browser, page, close } */
export async function launchPage({ width, height, scale = 1, args = RENDER_ARGS } = {}) {
  const puppeteer = await loadPuppeteer();
  const browser = trackBrowser(await puppeteer.launch({ headless: true, args, protocolTimeout: PROTOCOL_TIMEOUT_MS }));
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  return { browser, page, close: () => browser.close() };
}
