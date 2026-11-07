// The loop's facts are digests: a draft is current when its sidecar's page digest equals the page's now, whatever the mtimes say.
// The sidecar test renders a tiny page, so it needs Chrome and ffmpeg.   node --test tests/lib/loop-state.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loopState, LOOP_STAGES } from '../../harness/lib/loop-state.mjs';
import { writeRenderMeta, metaPath } from '../../harness/lib/render-meta.mjs';
import { pageDigest, draftState, writeApproval } from '../../harness/lib/approval.mjs';
import { nextStep } from '../../harness/live/stage-say.mjs';
import { STAGES } from '../../harness/lib/trace/stages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HTML = '<section data-world="s1"></section>';

function film(html = HTML) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-loop-'));
  fs.mkdirSync(path.join(root, 'films', 'f'), { recursive: true });
  fs.mkdirSync(path.join(root, 'out'));
  const page = path.join(root, 'films', 'f', 'page.html');
  fs.writeFileSync(page, html);
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), '## Look\n');
  return { root, page, draft: path.join(root, 'out', 'f-draft.mp4') };
}

function drafted(html) {
  const f = film(html);
  fs.writeFileSync(f.draft, '');
  writeRenderMeta(f.draft, { pageDigest: pageDigest(f.page) });
  return f;
}

const at = (file, msAgo) => { const d = new Date(Date.now() - msAgo); fs.utimesSync(file, d, d); };

test('a one-byte page change makes the draft stale, and reverting it makes the draft current again', () => {
  const { root, page } = drafted();
  at(page, 60000);
  assert.equal(loopState(page, root).draft.current, true);
  assert.equal(nextStep(page, root).stage, 'motion');
  fs.writeFileSync(page, `${HTML} `);
  assert.equal(loopState(page, root).draft.current, false);
  assert.equal(nextStep(page, root).stage, 'draft');
  fs.writeFileSync(page, HTML);
  const state = loopState(page, root);
  assert.ok(fs.statSync(page).mtimeMs > fs.statSync(state.draft.path).mtimeMs, 'the page is newer than the draft by mtime');
  assert.equal(state.draft.current, true);
  assert.equal(state.draft.digest, state.pageDigest);
  assert.equal(nextStep(page, root).stage, 'motion');
});

test('a touch with no content change keeps the draft current', () => {
  const { root, page } = drafted();
  fs.utimesSync(page, new Date(Date.now() + 60000), new Date(Date.now() + 60000));
  assert.equal(loopState(page, root).draft.current, true);
  assert.equal(nextStep(page, root).stage, 'motion');
});

test('a draft with no sidecar falls back to the mtime rule', () => {
  const { root, page, draft } = film();
  fs.writeFileSync(draft, '');
  at(page, 60000);
  assert.deepEqual({ ...loopState(page, root).draft, path: null }, { digest: null, path: null, current: true });
  at(draft, 120000);
  assert.equal(loopState(page, root).draft.current, false);
});

test('no render gives null draft and final, and every critique and approval is read by digest', () => {
  const { root, page } = film();
  const state = loopState(page, root);
  assert.equal(state.draft, null);
  assert.equal(state.final, null);
  assert.equal(state.critique, null);
  assert.deepEqual(state.approval, { plan: 'none', draft: 'none' });
  fs.writeFileSync(path.join(root, 'out', 'f-draft.mp4'), '');
  writeRenderMeta(path.join(root, 'out', 'f-draft.mp4'), { pageDigest: state.pageDigest });
  const line = (pageHash) => `${JSON.stringify({ cmd: 'verb', verb: 'critique', exitCode: 0, pageHash, fresh: true })}\n`;
  fs.writeFileSync(path.join(root, 'out', 'f.runs.jsonl'), line('not-this-page'));
  assert.equal(loopState(page, root).critique, null);
  fs.appendFileSync(path.join(root, 'out', 'f.runs.jsonl'), line(state.pageDigest));
  assert.equal(loopState(page, root).critique.fresh, true);
});

test('the draft approval goes stale when the page changes and fresh again when it is reverted', () => {
  const { root, page } = drafted();
  writeApproval(page, { root });
  assert.equal(draftState(page, { root }), 'fresh');
  fs.writeFileSync(page, `${HTML} `);
  assert.equal(draftState(page, { root }), 'stale');
  fs.writeFileSync(page, HTML);
  assert.equal(loopState(page, root).approval.draft, 'fresh');
});

test('the trace review and the stage hook share one stage list', () => {
  const traced = LOOP_STAGES.filter((s) => s.trace).map((s) => s.trace);
  assert.deepEqual(STAGES, traced);
  const names = LOOP_STAGES.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  const { root, page } = drafted();
  assert.ok(names.includes(nextStep(page, root).stage));
});

test('a draft render writes its sidecar last, as valid JSON with the render facts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-sidecar-'));
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=64x36:r=10:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(dir, 'clip.mp4')]);
    fs.writeFileSync(path.join(dir, 'page.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="duration" content="1.5">
<style>*{margin:0}html,body{background:#111}section{position:absolute;inset:0;width:100vw;height:100vh}video{position:absolute;top:0;left:0;width:30vw;height:30vh}#b{animation:in 0.1s 0.8s both}@keyframes in{from{opacity:0}to{opacity:1}}</style></head>
<body><section data-world="a" style="background:#223"></section><section id="b" data-world="b" style="background:#322"></section><video src="clip.mp4" data-at="0.2" data-trim="0.1" data-rate="2" muted></video></body></html>`);
    const out = path.join(dir, 'out.mp4');
    const r = spawnSync('node', [path.join(ROOT, 'harness/media/render-page.mjs'), path.join(dir, 'page.html'), out, '--fps', '10', '--w', '160', '--h', '90', '--silent'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const meta = JSON.parse(fs.readFileSync(metaPath(out), 'utf8'));
    assert.equal(meta.pageDigest, pageDigest(path.join(dir, 'page.html')));
    assert.match(meta.renderKey, /^[0-9a-f]{16}$/);
    assert.deepEqual({ final: meta.final, fps: meta.fps, width: meta.width, height: meta.height, duration: meta.duration, from: meta.from, to: meta.to }, { final: false, fps: 10, width: 160, height: 90, duration: 1.5, from: 0, to: 1.5 });
    assert.deepEqual(meta.clips, [{ src: 'clip.mp4', at: 0.2, trim: 0.1, trimEnd: null, rate: 2 }]);
    assert.deepEqual(meta.worlds.map((w) => w.id), ['a', 'b']);
    assert.ok(meta.worlds.every((w) => typeof w.start === 'number' && w.end > w.start));
    assert.deepEqual(meta.audio, { mixed: false, loudness: null, cues: [] });
    assert.ok(Number.isFinite(Date.parse(meta.createdAt)));
    assert.ok(fs.statSync(metaPath(out)).mtimeMs >= fs.statSync(out).mtimeMs, 'the sidecar is written after the mp4');
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.includes('.tmp-')), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
