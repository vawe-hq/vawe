// One load of the page for the template export: every frame's layers and texts, the style of each text at its key frame, the
// worlds and the sound cues. No frame is rendered here; template-export.mjs renders the clips after.
import path from 'node:path';
import { openPage, gotoLoaded, settle, resolveFrame } from './render-page.mjs';
import { resolveDuration } from './page-duration.mjs';
import { sampleWorlds, SHOWS_SOURCE } from './world-sample.mjs';
import { readPageAudio } from './page-audio.mjs';
import { pageChildren, pageHosts, pageFrame, pageStyles } from './template-sample.mjs';
import { TemplateError, keyFrameOf } from '../lib/template-plan.mjs';

function checkHosts(inputs, hosts) {
  inputs.forEach((input, i) => {
    const { count, nth } = hosts[i];
    if (count !== 1) throw new TemplateError(`template.json input "${input.id}": selector "${input.selector}" matches ${count} elements; it must match exactly one`);
    if (nth == null) throw new TemplateError(`template.json input "${input.id}": "${input.selector}" is not inside <body>`);
  });
  return hosts.map((h) => h.nth);
}

async function sampleFrames(page, frames, fps, selectors) {
  const samples = [];
  for (let j = 0; j < frames; j++) {
    await page.evaluate((t) => window.__pageSeek(t, window, true), j / fps);
    samples.push(await pageFrame(page, selectors, SHOWS_SOURCE));
  }
  return samples;
}

async function stylesAt(page, inputs, samples, fps) {
  const styles = [];
  for (const [i, input] of inputs.entries()) {
    const key = keyFrameOf(input, samples.map((s) => s.texts[i]), fps);
    await page.evaluate((t) => window.__pageSeek(t, window, true), key / fps);
    [styles[i]] = await pageStyles(page, [input.selector]);
  }
  return styles;
}

/**
 * readFilm(pagePath, { fps, inputs }) -> { duration, frames, width, height, children, hosts, samples, styles, spans, audio }.
 * children: the body's elements (template-sample.mjs readChildren); hosts: the nth of the body child that holds each input; samples: one readFrame per frame at `fps`; spans: the worlds
 * (world-sample.mjs sampleWorlds); audio: readPageAudio with data-on resolved.
 */
export async function readFilm(pagePath, { fps, inputs }) {
  const abs = path.resolve(pagePath);
  const frame = resolveFrame(abs, { final: true });
  const duration = await resolveDuration(abs);
  if (!(duration > 0)) throw new TemplateError(`${pagePath} has no length: add <meta name="duration" content="<seconds>">`);
  const opened = await openPage(abs, { ...frame, duration }, { final: true });
  try {
    await gotoLoaded(opened.page, opened.url, abs);
    await settle(opened.page);
    const selectors = inputs.map((i) => i.selector);
    const hosts = checkHosts(inputs, await pageHosts(opened.page, selectors));
    const children = await pageChildren(opened.page);
    const frames = Math.round(duration * fps);
    const samples = await sampleFrames(opened.page, frames, fps, selectors);
    const styles = await stylesAt(opened.page, inputs, samples, fps);
    const spans = await sampleWorlds(opened.page, duration, (ms) => opened.page.evaluate((t) => window.__pageSeek(t / 1000, window, true), ms));
    const audio = await readPageAudio(opened.page, { pagePath: abs, spans, duration });
    return { duration, frames, width: frame.outWidth, height: frame.outHeight, children, hosts, samples, styles, spans, audio };
  } finally {
    await opened.close();
  }
}
