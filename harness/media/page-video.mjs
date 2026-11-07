// harness/media/page-video.mjs: the render lint for <video> clips (the contract is in skills/vawe-page/SKILL.md; the
// seek is core/engine/page-seek.js). A missing file or a bad number refuses the render; a trim-end past the file's end is
// clamped by the seek, so it only warns.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from '../lib/render-harness.mjs';

const fileOf = (src, pagePath) => (src.startsWith('/') ? path.join(REPO_ROOT, src) : path.resolve(path.dirname(pagePath), src));

export function fileSeconds(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  return d > 0 ? d : NaN;
}

// clips: [{ label, src, file, exists, duration, trim, trimEnd, rate }]; trimEnd is null when the page leaves it out.
export function videoFindings(clips) {
  const problems = [], warnings = [];
  for (const c of clips) {
    const where = `<video src="${c.src}">`;
    if (!c.src) { problems.push(`${c.label}: a <video> clip needs a src`); continue; }
    if (!c.exists) { problems.push(`${where}: ${c.file} does not exist`); continue; }
    if (!(c.rate > 0)) problems.push(`${where}: data-rate must be above 0 (got ${c.rate})`);
    if (!(c.trim >= 0)) problems.push(`${where}: data-trim must be 0 or more (got ${c.trim})`);
    const end = c.trimEnd ?? c.duration;
    if (c.trimEnd !== null && !Number.isFinite(c.trimEnd)) problems.push(`${where}: data-trim-end is not a number`);
    else if (c.trim >= end) problems.push(`${where}: data-trim ${c.trim} is not before the end ${end}${c.trimEnd === null ? ' of the file' : ' (data-trim-end)'}`);
    else if (c.trimEnd !== null && c.trimEnd > c.duration) warnings.push(`${where}: data-trim-end ${c.trimEnd} is past the end of the file (${c.duration.toFixed(2)} s): the clip holds its last frame from there`);
  }
  return { problems, warnings };
}

export async function readPageVideos(page, pagePath) {
  const raw = await page.evaluate(() => {
    const num = (el, name, fallback) => (el.hasAttribute(name) ? Number(el.getAttribute(name)) : fallback);
    return [...document.querySelectorAll('video')].map((el, i) => ({
      label: `<video> #${i + 1}`,
      src: el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || '',
      at: num(el, 'data-at', 0), trim: num(el, 'data-trim', 0), trimEnd: num(el, 'data-trim-end', null), rate: num(el, 'data-rate', 1),
    }));
  });
  const clips = raw.map((c) => {
    const file = c.src ? fileOf(decodeURI(c.src.split(/[?#]/)[0]), pagePath) : '';
    const exists = Boolean(file) && fs.existsSync(file);
    return { ...c, file, exists, duration: exists ? fileSeconds(file) : NaN };
  });
  return { ...videoFindings(clips), clips: clips.map(({ src, at, trim, trimEnd, rate }) => ({ src, at, trim, trimEnd, rate })) };
}
