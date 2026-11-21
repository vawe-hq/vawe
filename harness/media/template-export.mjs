#!/usr/bin/env node
// `vawe-dev template <page>`: a zip a motion designer opens in Premiere Pro or After Effects as an editable template.
//   node harness/media/template-export.mjs <page.html> [--fps 30] [--blur 32] [--out dir]
// One page load reads the layers, the texts and the sound (template-read.mjs); each layer then renders through renderPage as a
// ProRes 4444 clip with alpha, the sound as wavs, and the timeline as FCP 7 XML and an After Effects script.
import fs from 'node:fs';
import path from 'node:path';
import { paintedFrames, clipKind, toStill } from './template-clips.mjs';
import { renderPage } from './render-page.mjs';
import { writeStems } from './page-audio.mjs';
import { readFilm } from './template-read.mjs';
import { fontFileOf, postScriptName } from './template-sample.mjs';
import { layerCss } from '../../core/engine/page-layer.js';
import { readTemplate, planLayers, textTrack, paintedSamples, soundClips, worldMarkers, TemplateError } from '../lib/template-plan.mjs';
import { premiereXml } from '../lib/premiere-xml.mjs';
import { aeJsx } from '../lib/ae-jsx.mjs';
import { templateReadme } from '../lib/template-readme.mjs';
import { zipFolder } from '../lib/zip-write.mjs';
import { referencedFiles } from '../lib/template-refs.mjs';
import { REPO_ROOT } from '../lib/render-harness.mjs';
import { paramsFilm } from '../lib/page-params.mjs';
import { appendRun } from '../lib/runlog.mjs';

// The folder the Premiere pathurls name. It is never a real path of this machine (that would put a user name in a public download),
// so Premiere asks for the media once and relinks the rest by name.
const MEDIA_ROOT = '/vawe-template/media';

const childSel = (nth) => `body > :nth-child(${nth})`;

function childRows(film) {
  return film.children.filter((c) => !c.silent).map((c) => ({
    ...c,
    blends: [...new Set(film.samples.map((s) => s.children[c.nth - 1].blend))],
    shown: film.samples.map((s) => s.children[c.nth - 1].shown),
  }));
}

/**
 * Renders one clip in the work folder (where its sidecar and a failed render's frames stay, so the next run resumes them) and moves it
 * to media/: as is, as one PNG when no frame differs, or not at all when it paints nothing. Returns { file, painted }; file is null when dropped.
 */
async function renderClip(pagePath, name, layer, [start, end], { fps, blur, work, media }) {
  const out = path.join(work, `${name}.mov`);
  const r = await renderPage(pagePath, out, { final: true, fps, blur, from: start / fps, durArg: (end - start) / fps, layer });
  if (r.frames !== end - start) throw new Error(`${out}: rendered ${r.frames} frames, the timeline needs ${end - start}`);
  const moved = path.join(media, `${name}.mov`);
  fs.renameSync(out, moved);
  const painted = paintedFrames(moved);
  const kind = clipKind(moved, painted);
  if (kind === 'empty') fs.rmSync(moved);
  const file = kind === 'empty' ? null : kind === 'still' ? toStill(moved) : `${name}.mov`;
  console.log(`template: ${name}: ${r.frames} frames, ${(r.captureMs / 1000).toFixed(1)} s capture, ${kind}${file ? ` (${file})` : ', left out'}`);
  return { file, painted };
}

const clipEntry = (name, file, [start, end], extra) => ({ kind: 'clip', name, file, start, end, ...extra });

async function textEntries(pagePath, layer, others, text, opts) {
  const ref = `${layer.name}-text-${text.track.id}`;
  const { file, painted } = await renderClip(pagePath, ref, { css: layerCss({ hide: others, textOnly: text.track.selector }), textOnly: text.track.selector }, text.track.span, opts);
  const track = textTrack(text.input, paintedSamples(text.samples, painted, text.track.span[0]), text.track.style, opts.fps);
  if (!track.span) {
    opts.notes.push(`input "${text.input.id}" is never painted (a clip or a mask hides it), so it has no editable layer.`);
    return [];
  }
  return [clipEntry(ref, file, text.track.span, { blend: 'normal', reference: true }), { kind: 'text', track, font: text.font }];
}

/** Renders each layer, and each editable text's reference clip right above its layer; returns the stack, bottom first. */
async function renderStack(pagePath, { layers, texts, rows, hosts }, opts) {
  const stack = [];
  for (const layer of layers) {
    const others = rows.filter((r) => !layer.members.includes(r.nth)).map((r) => childSel(r.nth));
    const own = texts.filter((t) => layer.members.includes(hosts[t.index]));
    const noText = own.map((t) => t.track.selector);
    const { file } = await renderClip(pagePath, layer.name, { css: layerCss({ hide: others, noText }), noText }, layer.span, opts);
    if (file) stack.push(clipEntry(layer.name, file, layer.span, { blend: layer.blend, blendVaries: layer.blendVaries }));
    else opts.notes.push(`layer ${layer.name} paints nothing${own.length ? ' once its editable text is lifted out' : ''}, so it has no clip.`);
    for (const text of own) stack.push(...await textEntries(pagePath, layer, others, text, opts));
  }
  return stack;
}

async function fontFile(style, fontsDir, notes) {
  const file = fontFileOf(style.fontUrl);
  if (!file) { notes.push(`${style.family} is not a font file of the page (a system font?): it is not in fonts/.`); return null; }
  const ext = path.extname(file).toLowerCase();
  if (ext === '.woff2') {
    try {
      const wawoff2 = await import('wawoff2');
      const out = path.join(fontsDir, `${path.basename(file, ext)}.ttf`);
      fs.writeFileSync(out, Buffer.from(await wawoff2.decompress(fs.readFileSync(file))));
      return out;
    } catch { notes.push(`${path.basename(file)} is a web font (woff2): convert it to TTF before you install it.`); }
  } else if (ext === '.woff') notes.push(`${path.basename(file)} is a web font (woff): convert it to TTF before you install it.`);
  const out = path.join(fontsDir, path.basename(file));
  fs.copyFileSync(file, out);
  return out;
}

async function editableTexts(film, inputs, fontsDir, notes) {
  const texts = [];
  for (const [index, input] of inputs.entries()) {
    const track = textTrack(input, film.samples.map((s) => s.texts[index]), film.styles[index], film.fps);
    if (!track.span) { notes.push(`input "${input.id}" (${input.selector}) never shows, so it has no layer.`); continue; }
    const file = await fontFile(track.style, fontsDir, notes);
    const font = await postScriptName(fontFileOf(track.style.fontUrl), track.style);
    texts.push({ index, input, samples: film.samples.map((s) => s.texts[index]), track, font: { ...font, file: file && path.basename(file) } });
  }
  return texts;
}

function writeDocs(folder, name, doc) {
  const seq = { name, width: doc.width, height: doc.height, fps: doc.fps, frames: doc.frames, markers: doc.markers };
  const xml = premiereXml({ ...seq, mediaRoot: MEDIA_ROOT, video: doc.stack.filter((e) => e.kind === 'clip'), audio: doc.audio });
  const jsx = aeJsx({ ...seq, stack: doc.stack, audio: doc.audio });
  fs.writeFileSync(path.join(folder, 'premiere', `${name}.xml`), xml);
  fs.writeFileSync(path.join(folder, 'after-effects', `build-${name}.jsx`), jsx);
  const layers = doc.stack.filter((e) => e.kind === 'clip');
  fs.writeFileSync(path.join(folder, 'README.txt'), `${templateReadme({ ...seq, layers, texts: doc.texts, audio: doc.stems, skipped: doc.skipped, notes: doc.notes })}\n`);
  const texts = doc.texts.map(({ track, font }) => ({ id: track.id, label: track.label, selector: track.selector, text: track.style.text, font, size: track.style.size, start: track.span[0], end: track.span[1], cutBy: track.effects }));
  fs.writeFileSync(path.join(folder, 'export.json'), `${JSON.stringify({ ...seq, layers, texts, audio: doc.audio, skipped: doc.skipped, notes: doc.notes }, null, 2)}\n`);
  return referencedFiles(xml, jsx);
}

function prepare(root, name) {
  const folder = path.join(root, `${name}-template`);
  fs.rmSync(folder, { recursive: true, force: true });
  for (const sub of ['media', 'premiere', 'after-effects', 'fonts']) fs.mkdirSync(path.join(folder, sub), { recursive: true });
  return folder;
}

/** exportTemplate(pagePath, { fps, blur, out }) -> { folder, zip, entries, missing }: the template folder and its zip, next to each other in `out`. */
export async function exportTemplate(pagePath, { fps = 30, blur = 32, out = null } = {}) {
  const abs = path.resolve(pagePath);
  const { inputs } = readTemplate(abs);
  const name = paramsFilm(path.basename(path.dirname(abs)));
  const root = out ? path.resolve(out) : path.join(REPO_ROOT, 'out', `${name}-template`);
  const folder = prepare(root, name);
  const film = { ...await readFilm(abs, { fps, inputs }), fps };
  const rows = childRows(film);
  const { layers, skipped } = planLayers(rows, new Set(film.hosts));
  const notes = [];
  const provisional = await editableTexts(film, inputs, path.join(folder, 'fonts'), notes);
  const work = path.join(root, 'work');
  fs.mkdirSync(work, { recursive: true });
  const stack = await renderStack(abs, { layers, texts: provisional, rows, hosts: film.hosts }, { fps, blur, work, notes, media: path.join(folder, 'media') });
  const texts = stack.filter((e) => e.kind === 'text');
  const stems = writeStems({ specs: film.audio.specs, duration: film.duration, loudness: film.audio.loudness, dir: path.join(folder, 'media') });
  const audio = soundClips(stems, film.frames, fps);
  const refs = writeDocs(folder, name, { width: film.width, height: film.height, fps, frames: film.frames, markers: worldMarkers(film.spans, fps), stack, audio, texts, stems, skipped, notes });
  const missing = refs.filter((f) => !fs.existsSync(path.join(folder, 'media', f)));
  if (missing.length) throw new Error(`the timeline names files that were not written: ${missing.join(', ')}`);
  const zip = path.join(root, `${name}-template.zip`);
  const entries = zipFolder(folder, zip, { prefix: `${name}-template` });
  appendRun(abs, { cmd: 'template', fps, blur, layers: layers.length, texts: texts.length, cues: stems.cues.length, skipped, notes, zip: path.relative(REPO_ROOT, zip) });
  return { folder, zip, entries, refs, notes };
}

function flagOf(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
}

async function main(argv) {
  const [pagePath] = argv.filter((a, i) => !a.startsWith('--') && !['--fps', '--blur', '--out'].includes(argv[i - 1]));
  if (!pagePath) throw new TemplateError('usage: node harness/media/template-export.mjs <page.html> [--fps 30] [--blur 32] [--out dir]');
  const fps = Number(flagOf(argv, '--fps', 30));
  const blur = Number(flagOf(argv, '--blur', 32));
  if (!(Number.isInteger(fps) && fps >= 1 && fps <= 99)) throw new TemplateError(`--fps must be a whole number from 1 to 99 (After Effects' limit), got ${fps}`);
  if (!(Number.isInteger(blur) && blur >= 1)) throw new TemplateError(`--blur must be a whole number, 1 or more, got ${blur}`);
  const r = await exportTemplate(pagePath, { fps, blur, out: flagOf(argv, '--out', null) });
  console.log(`template: ${r.entries.length} files, ${r.refs.length} named by the timeline, all present`);
  for (const note of r.notes) console.log(`template: note: ${note}`);
  console.log(`template: ${r.zip}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`error: ${e instanceof TemplateError ? e.message : e.stack || String(e)}`);
    process.exitCode = e instanceof TemplateError ? 2 : 1;
  });
}
