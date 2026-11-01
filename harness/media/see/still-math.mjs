// Pure parts of `vawe frame`. No I/O and no heavy imports: harness/cli/verbs.mjs loads this file to check the arguments.
import path from 'node:path';
import { isUrl } from '../../lib/url.mjs';
import { atProblem } from './at-problem.mjs';
import { paramsFilm } from '../../lib/page-params.mjs';
import { aspectDims } from '../../../core/layout/aspects.js';

const USAGE = 'usage: bin/vawe frame <page|mp4> --at <s> [--out file.png]';

/** The first problem in the arguments of still, or null. Pure. */
export function stillProblem({ source, at, size }) {
  if (!source) return `missing <page|mp4>; ${USAGE}`;
  if (at === undefined) return `missing --at <s>, the second to write; ${USAGE}`;
  if (size !== undefined && !/^[1-9]\d*x[1-9]\d*$/.test(size)) return `--size is not WxH in pixels, for example 1200x630: "${size}"`;
  return atProblem(at);
}

/** The reason a WxH size does not fit the aspect (its height for that width must be the aspect's), or null. Pure. */
export function sizeProblem(size, aspect) {
  const [w, h] = size.split('x').map(Number);
  const [aw, ah] = aspectDims(aspect);
  const want = Math.round((w * ah) / aw);
  if (h === want) return null;
  return `--size ${size} is not the aspect ${aspect}: at width ${w} that aspect is ${w}x${want}. Pass --aspect ${w}:${h} for this size, or a size with the ratio of ${aspect}`;
}

/** The default PNG path: out/still/<film>[-<params>][-<size>]-<seconds>s.png. Pure. */
export function stillPath(source, at, size) {
  const abs = isUrl(source) ? new URL(source).pathname : path.resolve(source);
  const base = path.basename(abs, path.extname(abs));
  const film = base === 'page' ? path.basename(path.dirname(abs)) : base;
  return path.resolve('out', 'still', `${paramsFilm(film)}${size ? `-${size}` : ''}-${at}s.png`);
}

/** The ffmpeg argv for one frame. A URL seeks on the input so ffmpeg reads one range, not the file up to the second. Pure. */
export function stillArgs(source, seek, out) {
  const ss = ['-ss', seek.toFixed(4)];
  const input = isUrl(source) ? [...ss, '-i', source] : ['-i', source, ...ss];
  return ['-v', 'error', '-y', ...input, '-frames:v', '1', out];
}
