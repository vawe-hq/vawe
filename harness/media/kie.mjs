import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from '../lib/is-main.mjs';

const BASE = 'https://api.kie.ai';
const UPLOAD = 'https://kieai.redpandaai.co';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function getKey() {
  if (process.env.KIE_API_KEY) return process.env.KIE_API_KEY.trim();
  const f = path.join(ROOT, '.kie.key');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  throw new Error('no kie.ai key: set env KIE_API_KEY or write it to .kie.key (gitignored)');
}
const authHeaders = () => ({ Authorization: `Bearer ${getKey()}`, 'Content-Type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + pathname, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(`kie ${method} ${pathname} → ${res.status} ${json.msg || JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data ?? json;
}

// unified Jobs API (image, tts, stt, kling video, …)
export async function createTask(model, input, { callBackUrl } = {}) {
  const data = await api('/api/v1/jobs/createTask', { method: 'POST', body: { model, input, ...(callBackUrl ? { callBackUrl } : {}) } });
  const taskId = data.taskId || data.task_id;
  if (!taskId) throw new Error(`no taskId in createTask response: ${JSON.stringify(data)}`);
  return taskId;
}

// poll recordInfo until terminal; returns the parsed result object (with resultUrls[]).
export async function pollTask(taskId, { interval = 3000, timeout = 600000, onProgress } = {}) {
  const start = Date.now();
  for (;;) {
    const d = await api(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
    const state = d.state || d.status;
    if (onProgress) onProgress(state, d.progress);
    if (state === 'success' || state === 'completed') {
      let out = {};
      try { out = typeof d.resultJson === 'string' ? JSON.parse(d.resultJson) : (d.resultJson || {}); } catch { out = {}; }
      const urls = out.resultUrls || out.result_urls || out.urls || [];
      return { urls, raw: d, result: out };
    }
    if (state === 'fail' || state === 'failed' || state === 'error') {
      throw new Error(`task ${taskId} failed: ${d.failMsg || d.failCode || 'unknown'}`);
    }
    if (Date.now() - start > timeout) throw new Error(`task ${taskId} timed out after ${timeout}ms (last state: ${state})`);
    await sleep(interval);
  }
}

// run a unified job end to end → array of result URLs.
export async function runJob(model, input, opts = {}) {
  const taskId = await createTask(model, input, opts);
  if (opts.onTask) opts.onTask(taskId);
  const { urls } = await pollTask(taskId, opts);
  return urls;
}

// upload a local file → hosted URL (for STT audio / img2img inputs).
export async function uploadFile(localPath) {
  const buf = fs.readFileSync(localPath);
  const b64 = buf.toString('base64');
  const res = await fetch(`${UPLOAD}/api/file-base64-upload`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ base64: `data:application/octet-stream;base64,${b64}`, uploadPath: 'vawe', fileName: path.basename(localPath) }),
  });
  const json = await res.json().catch(() => ({}));
  const url = json?.data?.downloadUrl || json?.data?.url || json?.downloadUrl;
  if (!url) throw new Error(`upload failed: ${JSON.stringify(json).slice(0, 200)}`);
  return url;
}

// Read back the body, not just the status: a CDN can answer 200 with an HTML/JSON error page for an expired asset, so `download` also requires a magic-number match before writing.
const MAGIC = [ // enough of each container to tell media from an error page
  [[0xff, 0xd8, 0xff], 'jpeg'], [[0x89, 0x50, 0x4e, 0x47], 'png'], [[0x47, 0x49, 0x46], 'gif'],
  [[0x52, 0x49, 0x46, 0x46], 'riff/webp/wav'], [[0x49, 0x44, 0x33], 'mp3'], [[0xff, 0xfb], 'mp3'],
  [[0x4f, 0x67, 0x67, 0x53], 'ogg'], [[0x1a, 0x45, 0xdf, 0xa3], 'webm'],
];
const looksLikeMedia = (b) =>
  MAGIC.some(([sig]) => sig.every((c, i) => b[i] === c))
  || (b.length > 12 && b.slice(4, 8).toString('latin1') === 'ftyp'); // mp4/mov, whose magic sits at byte 4

export async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024 || !looksLikeMedia(buf))
    throw new Error(`download ${url} → HTTP ${res.status} but the body is not media `
      + `(${buf.length} bytes, content-type ${res.headers.get('content-type') || 'none'}, `
      + `starts ${JSON.stringify(buf.slice(0, 40).toString('latin1'))}). `
      + `Refusing to write ${dest}: a file that exists and cannot be decoded renders as an invisible hole.`);
  fs.writeFileSync(dest, buf);
  return dest;
}

const MODELS = {
  tts: 'elevenlabs/text-to-speech-multilingual-v2',
  stt: 'elevenlabs/speech-to-text',
  image: 'google/nano-banana',
  video: 'kling-3.0/video', // unified-API video (Veo uses a dedicated path; see below)
};

export function ttsInput(text, { voice = 'EkK5I93UQWFDigLMpZcX', speed = 1, stability = 0.5 } = {}) {
  return { model: MODELS.tts, input: { text, voice, speed, stability } };
}
export function imageInput(prompt, { aspect = '9:16', format = 'png' } = {}) {
  return { model: MODELS.image, input: { prompt, output_format: format, aspect_ratio: aspect } };
}
export function videoInput(prompt, { aspect = '9:16', duration = 5 } = {}) {
  return { model: MODELS.video, input: { prompt, aspect_ratio: aspect, duration } };
}
export function sttInput(audioUrl, { language } = {}) {
  return { model: MODELS.stt, input: { audio_url: audioUrl, ...(language ? { language_code: language } : {}) } };
}

export async function tts(text, opts = {}) { const { model, input } = ttsInput(text, opts); return runJob(model, input, opts); }
export async function image(prompt, opts = {}) { const { model, input } = imageInput(prompt, opts); return runJob(model, input, opts); }
export async function videoGen(prompt, opts = {}) { const { model, input } = videoInput(prompt, opts); return runJob(model, input, opts); }
export async function transcribeUrl(audioUrl, opts = {}) {
  const { model, input } = sttInput(audioUrl, opts);
  const taskId = await createTask(model, input, opts);
  const { result } = await pollTask(taskId, opts);
  return result; // { text, words:[{text,start,end}], ... }
}

// music uses the dedicated Suno API (submit + poll a different endpoint).
export async function music(prompt, { model = 'V4_5', instrumental = true, style, title, ...opts } = {}) {
  const body = { prompt, model, customMode: !!(style || title), instrumental, ...(style ? { style } : {}), ...(title ? { title } : {}) };
  const data = await api('/api/v1/generate', { method: 'POST', body });
  const taskId = data.taskId || data.task_id;
  if (opts.onTask) opts.onTask(taskId);
  const start = Date.now();
  for (;;) {
    // Suno poll endpoint (verify against docs.kie.ai/suno-api/get-music-details if this 404s)
    const d = await api(`/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`).catch((e) => ({ __err: e }));
    const items = d?.response?.sunoData || d?.data || d?.items || [];
    const done = Array.isArray(items) && items.find((x) => x.audioUrl || x.audio_url);
    if (done) return [done.audioUrl || done.audio_url];
    if (d?.status === 'FAILED' || d?.state === 'fail') throw new Error('music generation failed');
    if (Date.now() - start > 600000) throw new Error('music generation timed out');
    await sleep(4000);
  }
}

if (isMain(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = {};
  const pos = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; flags[k] = v; }
    else pos.push(rest[i]);
  }
  const dry = !!flags.dry;
  const arg = pos.join(' ');
  const out = flags.out;
  const log = (...a) => console.error(...a);

  const build = {
    tts: () => ttsInput(arg, { voice: flags.voice, speed: flags.speed ? +flags.speed : undefined }),
    image: () => imageInput(arg, { aspect: flags.aspect, format: flags.format }),
    video: () => videoInput(arg, { aspect: flags.aspect, duration: flags.duration ? +flags.duration : undefined }),
    stt: () => sttInput('<uploaded audio url>', { language: flags.language }),
  };

  try {
    if (!cmd || cmd === 'help') { log('commands: tts | image | music | video | stt   (--out FILE, --aspect 9:16, --dry)'); process.exit(cmd ? 0 : 1); }
    if (dry) {
      if (cmd === 'music') { console.log(JSON.stringify({ endpoint: '/api/v1/generate', body: { prompt: arg, model: flags.model || 'V4_5', instrumental: flags.instrumental !== undefined } }, null, 2)); process.exit(0); }
      const b = build[cmd]?.();
      if (!b) { log(`unknown command "${cmd}"`); process.exit(1); }
      console.log(JSON.stringify({ endpoint: '/api/v1/jobs/createTask', ...b }, null, 2));
      process.exit(0);
    }
    let urls;
    if (cmd === 'tts') urls = await tts(arg, { voice: flags.voice, onTask: (t) => log('task', t), onProgress: (s, p) => log('…', s, p ?? '') });
    else if (cmd === 'image') urls = await image(arg, { aspect: flags.aspect, onTask: (t) => log('task', t), onProgress: (s) => log('…', s) });
    else if (cmd === 'video') urls = await videoGen(arg, { aspect: flags.aspect, duration: flags.duration ? +flags.duration : undefined, onTask: (t) => log('task', t), onProgress: (s) => log('…', s) });
    else if (cmd === 'music') urls = await music(arg, { instrumental: flags.instrumental !== undefined, style: flags.style, onTask: (t) => log('task', t) });
    else if (cmd === 'stt') { const url = await uploadFile(pos[0]); const r = await transcribeUrl(url, { onProgress: (s) => log('…', s) }); const dst = out || 'transcript.json'; fs.writeFileSync(dst, JSON.stringify(r, null, 2)); log('✓ transcript →', dst); process.exit(0); }
    else { log(`unknown command "${cmd}"`); process.exit(1); }

    log('result urls:', urls);
    if (out && urls?.[0]) { await download(urls[0], out); log('✓ downloaded →', out); }
  } catch (e) {
    log('✗', e.message);
    process.exit(1);
  }
}
