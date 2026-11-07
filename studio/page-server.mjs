// studio/page-server.mjs: the human layer for a page film. The last 10% of a draft is a person nudging
// rhythm, so this edits exactly what the agent wrote: every edit is a text patch at a literal's range in
// the page file (studio/page-source.mjs), never a private format.
//
//   vawe dev films/<name>/page.html --studio [--port 8799]
//
// The page is served as itself, with the renderer's virtual clock and frame facts injected before its
// scripts (the same functions render-page.mjs injects), and the browser seeks it with core/engine/
// page-seek.js, the renderer's own seek. Dev tooling only.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openFile } from '../harness/lib/open-file.mjs';
import { serveRepo, REPO_ROOT } from '../harness/lib/render-harness.mjs';
import { resolveLength } from '../harness/media/page-duration.mjs';
import { installPageClock } from '../core/engine/page-clock.js';
import { installPageFrame, installPageReady, awaitReady } from '../core/engine/page-seek.js';
import { ASPECTS, aspectDims } from '../core/layout/aspects.js';
import { EASE_VARS } from '../core/motion/presets.js';
import { parsePage } from './page-source.mjs';
import { createEditor } from './save-edits.mjs';
import { chatRoutes } from './chat.mjs';

const pageArg = process.env.PAGE || process.argv[2];
if (!pageArg || !fs.existsSync(pageArg)) { console.error('usage: vawe dev films/<name>/page.html --studio [--port 8799]'); process.exit(2); }
const pageFile = path.resolve(pageArg);
const pageRel = path.relative(REPO_ROOT, pageFile).split(path.sep).join('/');
if (pageRel.startsWith('..')) { console.error('the page must sit inside the repo'); process.exit(2); }
const PORT = Number(process.env.PORT) || 8799;
const UI = path.join(REPO_ROOT, 'studio/ui');
const ASSETS = new Set(['page-studio.html', 'studio.css', 'page-studio.css', 'page-studio.js', 'page-model.js', 'page-edit.js', 'page-eases.js', 'dom.js', 'page-ease-menu.js']);

const editor = createEditor(pageFile);
const send = (res, code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
const sendJson = (res, code, body) => send(res, code, 'application/json', JSON.stringify(body));
const readBody = (req, cb) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(raw || '{}')); } catch (e) { cb(null, e); } });
};

const revOf = () => { const s = fs.statSync(pageFile); return `${s.mtimeMs}:${s.size}`; };
const pageModel = async () => {
  const model = parsePage(fs.readFileSync(pageFile, 'utf8'));
  const length = await resolveLength(pageFile);
  if (length.auto) model.meta.duration = String(length.seconds);
  return { path: pageRel, rev: revOf(), undo: editor.depth(), aspect: model.meta.aspect || '16:9', aspects: ASPECTS, model };
};

// The page itself, with the clock and frame facts installed before its first script, as render-page.mjs does.
async function framedPage(aspect) {
  const length = await resolveLength(pageFile, { aspect });
  const [width, height] = aspectDims(aspect);
  const boot = `<script>(${installPageClock})();(${installPageFrame})(${JSON.stringify({ aspect, width, height, eases: EASE_VARS, duration: length.auto ? length.seconds : undefined }).replace(/</g, '\\u003c')});(${installPageReady})();window.__pageReady = ${awaitReady};</script>`;
  const html = fs.readFileSync(pageFile, 'utf8');
  const at = html.match(/<head[^>]*>/i) || html.match(/<html[^>]*>/i) || html.match(/<!doctype[^>]*>/i);
  if (!at) return boot + html;
  const i = at.index + at[0].length;
  return html.slice(0, i) + boot + html.slice(i);
}

// ---- actions: the same vawe verbs an agent runs ------------------------------------------------------
const ACTIONS = {
  draft: (aspect) => ['dev', pageRel, ...(aspect ? ['--aspect', aspect] : [])],
  final: () => ['ship', pageRel, '--wait'],
  critique: () => ['critique', pageRel],
};
let job = null;
function startJob(kind, aspect) {
  const args = ACTIONS[kind](aspect);
  const child = spawn(process.execPath, [path.join(REPO_ROOT, 'bin/vawe'), ...args], { cwd: REPO_ROOT });
  job = { kind, cmd: `vawe ${args.join(' ')}`, lines: [], code: null, child };
  const take = (chunk) => { job.lines.push(...String(chunk).split('\n').filter(Boolean)); job.lines = job.lines.slice(-200); };
  child.stdout.on('data', take);
  child.stderr.on('data', take);
  child.on('error', (e) => { job.lines.push(e.message); job.code = -1; });
  child.on('close', (code) => { job.code = code; });
}
const jobView = () => (job ? { kind: job.kind, cmd: job.cmd, lines: job.lines, code: job.code, running: job.code === null } : null);

const chat = chatRoutes({
  cwd: REPO_ROOT,
  tools: `Read,Glob,Grep,Edit(${pageRel})`,
  context: () => [
    `You are editing one page film: ${pageRel}. Change only that file.`,
    'A film is one HTML page. Tunable numbers are literals in the page: [[frame, value], ...] tables, @keyframes stops,',
    'element.animate keyframes and :root custom properties. Change those literals in place and keep the page\'s own structure and style.',
    'The studio reloads the page when the file changes. Do not render. Reply in one or two short sentences.',
  ].join(' '),
});

const routes = (req, res) => {
  const [url, query] = req.url.split('?');
  const q = new URLSearchParams(query || '');
  if (url === '/' || url === '/studio') {
    send(res, 200, 'text/html', fs.readFileSync(path.join(UI, 'page-studio.html'), 'utf8').replaceAll('{{TITLE}}', pageRel));
    return true;
  }
  if (url.startsWith('/studio/ui/') && ASSETS.has(url.slice('/studio/ui/'.length))) {
    const name = url.slice('/studio/ui/'.length);
    send(res, 200, name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'text/javascript', fs.readFileSync(path.join(UI, name)));
    return true;
  }
  if (url === '/' + pageRel && q.has('aspect')) {
    if (!/^\d+:\d+$/.test(q.get('aspect'))) { send(res, 400, 'text/plain', 'aspect must be W:H'); return true; }
    framedPage(q.get('aspect')).then((html) => send(res, 200, 'text/html', html), (e) => send(res, 500, 'text/plain', String(e.message)));
    return true;
  }
  if (url === '/api/page') {
    pageModel().then((m) => sendJson(res, 200, m), (e) => sendJson(res, 500, { error: String(e.message) }));
    return true;
  }
  if (req.method === 'POST' && url === '/api/edit') {
    readBody(req, async (body, err) => {
      if (!body || !Array.isArray(body.edits)) return sendJson(res, 400, { ok: false, error: err ? String(err.message) : 'no edits' });
      try {
        sendJson(res, 200, { ok: true, ...await editor.save(body.edits, pageModel) });
      } catch (e) { sendJson(res, 409, { ok: false, error: String(e.message) }); }
    });
    return true;
  }
  if (req.method === 'POST' && url === '/api/undo') {
    editor.undo().then(pageModel).then((m) => sendJson(res, 200, { ok: true, ...m }), (e) => sendJson(res, 200, { ok: false, error: String(e.message) }));
    return true;
  }
  if (url === '/api/job') {
    if (req.method === 'POST') {
      readBody(req, (body) => {
        if (job?.code === null) return sendJson(res, 409, { ok: false, error: 'a job is already running', job: jobView() });
        if (!ACTIONS[body?.kind]) return sendJson(res, 400, { ok: false, error: 'unknown action' });
        startJob(body.kind, body.aspect);
        sendJson(res, 200, { ok: true, job: jobView() });
      });
      return true;
    }
    sendJson(res, 200, { job: jobView() });
    return true;
  }
  return chat(req, res, url);
};

const { server } = await serveRepo({ port: PORT, route: routes }).catch((e) => {
  console.error(e.code === 'EADDRINUSE' ? `port ${PORT} is busy, set a free one: vawe dev ${pageRel} --studio --port 8800` : e.message);
  process.exit(1);
});
server.on('error', (e) => { console.error(e.message); process.exit(1); });

const url = `http://127.0.0.1:${PORT}/studio`;
console.log(`\n  vawe studio (page): ${pageRel}\n    open  ${url}\n    Ctrl-C to stop.\n`);
if (!process.env.NOOPEN) openFile(url);
