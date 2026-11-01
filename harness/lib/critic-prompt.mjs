// The prompt and the file names of `vawe critique --fresh`. The prompt text itself is owned by skills/vawe-critique/SKILL.md.
import fs from 'node:fs';
import path from 'node:path';

const PROMPT_RE = /"(You are the critic\..*?end with the REJECT or PASS line\.)"/s;
const VERDICT_RE = /^(REJECT|PASS)\b/;

/** The quoted critic prompt of the skill, or null when the section no longer holds it. */
export const criticTemplate = (skillText) => PROMPT_RE.exec(skillText)?.[1].replace(/\s+/g, ' ') ?? null;

/** The REJECT or PASS line a critique ends with, or null. */
export function verdictLine(text) {
  const last = String(text).split('\n').map((l) => l.trim().replace(/^[`*]+|[`*]+$/g, '')).filter(Boolean).at(-1);
  return last && VERDICT_RE.test(last) ? last : null;
}

const critiqueNumber = (film, name) => Number(new RegExp(`^${film}\\.critique-(\\d+)\\.md$`).exec(name)?.[1] ?? 0);

/** The critique files of a film in `outDir`, as { next, previous }: the path to write and the newest existing one (or null). */
export function critiqueFiles(outDir, film) {
  const numbers = fs.existsSync(outDir) ? fs.readdirSync(outDir).map((n) => critiqueNumber(film, n)).filter(Boolean) : [];
  const at = (n) => path.join(outDir, `${film}.critique-${n}.md`);
  const top = Math.max(0, ...numbers);
  return { next: at(top + 1), previous: top ? at(top) : null };
}

/** The whole prompt: the skill's critic prompt, then the inputs and how to answer. `inputs` is { page, mp4, ref, brief, previous, images } (a missing one is "none"). */
export function criticPrompt(template, { page, mp4, ref, brief, previous, images }) {
  const none = (v) => v || 'none';
  return `${template}

Inputs. Open them with the Read tool; you have no other tool.
- Film page: ${page}
- Rendered draft: ${none(mp4)} (a video: judge it through the images below)
- Reference: ${none(ref)}
- Brief: ${none(brief)}
- Previous critique: ${none(previous)}${previous ? ' (check each finding was fixed, not moved)' : ''}
- Views of this draft (Read every one at full size):
${images.length ? images.map((p) => `  ${p}`).join('\n') : '  none were written'}

Reply with the whole critique as Markdown, one finding per line with a second, a frame and a file with line. The last line is exactly the REJECT or PASS line.`;
}
