// Options a render verb hands to the page: `--param look=riso` reaches the page as `?look=riso`.
// `--aspect 1200:630` overrides the page's aspect meta; it is not a page option, but it is part of the render key and of the file names like one.
// `--data file.json` hands the page structured input: it reads `window.VAWE_DATA`, set before any page script runs. Like a param it is part of the render key and of the file names.
// bin/vawe turns the flags into VAWE_PARAMS, VAWE_ASPECT, VAWE_DATA (the canonical JSON) and VAWE_DATA_FILE (the path, to print commands) for every step it runs. The loaders and every per-film file name read them through this file.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const PARAMS_ENV = 'VAWE_PARAMS';
export const ASPECT_ENV = 'VAWE_ASPECT';
export const DATA_ENV = 'VAWE_DATA';
export const DATA_FILE_ENV = 'VAWE_DATA_FILE';

/** A bad `--data` file: `message` is the error line, `fix` the line after it. */
export class DataError extends Error {
  constructor(message, fix) {
    super(message);
    this.fix = fix;
  }
}

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);

/** The JSON of `value` with every object's keys sorted, so two files that differ only in key order or white space name one render. */
export const canonicalJson = (value) => JSON.stringify(sortKeys(value));

/** The canonical JSON of the file a `--data` flag names. Throws a DataError for a missing or unreadable file or bad JSON. */
export function dataValue(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    throw new DataError(`--data ${file}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`, 'pass the path of a JSON file, for example --data films/my-film/data.json');
  }
  try { return canonicalJson(JSON.parse(text)); } catch (e) {
    throw new DataError(`--data ${file}: not valid JSON (${e.message})`, 'fix the JSON in the file; the page reads it as window.VAWE_DATA');
  }
}

const dataHash = (env) => (env[DATA_ENV] ? createHash('sha1').update(env[DATA_ENV]).digest('hex').slice(0, 8) : '');

/** The run-key part of the data: a short hash of the canonical JSON, '' for none. */
export const dataKey = (env = process.env) => dataHash(env);

/** The script that sets `window.VAWE_DATA` before the page's own scripts, or ''. Safe inside an inline <script>. */
export function dataScript(env = process.env) {
  return env[DATA_ENV] ? `window.VAWE_DATA = ${env[DATA_ENV].replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')};` : '';
}

export const isAspect = (name) => /^[1-9]\d*:[1-9]\d*$/.test(name);

/** The reason `name` is not an aspect (a W:H ratio of whole numbers), or null. */
export const aspectProblem = (name) => (isAspect(name) ? null : `"${name}" is not a W:H ratio of whole numbers such as 16:9 or 1200:630`);

/** `2:1` as it appears in a file name. */
export const aspectSlug = (name) => name.replace(':', 'x');

/** The VAWE_ASPECT value for a `--aspect` flag: '' for none or `all` (render-page.mjs loops over the named aspects itself). Throws on anything but a W:H ratio of whole numbers. */
export function aspectValue(flag) {
  if (flag === undefined || flag === 'all') return '';
  const problem = aspectProblem(flag);
  if (problem) throw new Error(`--aspect ${problem}`);
  return flag;
}

/** The env the flags set for a step; a flag left out sets nothing, so the caller's own env stays. */
export function renderEnv({ param, aspect, data }) {
  const env = { [PARAMS_ENV]: paramsQuery(param), [ASPECT_ENV]: aspectValue(aspect), [DATA_ENV]: data ? dataValue(data) : '', [DATA_FILE_ENV]: data ? path.resolve(data) : '' };
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v));
}

export const aspectOverride = (env = process.env) => env[ASPECT_ENV] ?? '';

// A repeated key is refused: the page reads one value per key, so the second would be dropped without a word.
export function paramsQuery(list) {
  const q = new URLSearchParams();
  for (const item of list ?? []) {
    const eq = String(item).indexOf('=');
    if (eq < 1) throw new Error(`--param needs key=value, got "${item}"`);
    const key = item.slice(0, eq);
    if (q.has(key)) throw new Error(`--param ${key} is given twice: a page reads one value per key`);
    q.append(key, item.slice(eq + 1));
  }
  q.sort();
  return q.toString();
}

export function pageQuery(env = process.env) {
  return env[PARAMS_ENV] ? `?${env[PARAMS_ENV]}` : '';
}

export function paramsSlug(env = process.env) {
  const params = [...new URLSearchParams(env[PARAMS_ENV] ?? '')].map(([k, v]) => `${k}-${v}`).join('_').replace(/[^A-Za-z0-9._-]+/g, '-');
  return [params, dataHash(env) && `data-${dataHash(env)}`, aspectSlug(aspectOverride(env))].filter(Boolean).join('_');
}

/** The name every per-film file under out/ is built from: the film, then the params and the aspect override, so two looks or two aspects of one page never share a file. */
export function paramsFilm(film, env = process.env) {
  const slug = paramsSlug(env);
  return slug ? `${film}-${slug}` : film;
}

/** The `--param k=v`, `--data file` and `--aspect W:H` words that put these options back on a printed command, or ''. */
export function paramsFlags(env = process.env) {
  const aspect = aspectOverride(env);
  const data = env[DATA_FILE_ENV] ? ` --data ${env[DATA_FILE_ENV]}` : '';
  return [...new URLSearchParams(env[PARAMS_ENV] ?? '')].map(([k, v]) => ` --param ${k}=${v}`).join('') + data + (aspect ? ` --aspect ${aspect}` : '');
}
