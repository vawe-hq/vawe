// Small helpers the verb tables share.
import path from 'node:path';
import { UsageError } from './parse.mjs';
import { renderEnv, DataError } from '../lib/page-params.mjs';

export const opt = (flag, value) => (value === undefined ? [] : [flag, String(value)]);

export const pageName = (page) => {
  const base = path.basename(page, '.html');
  return base === 'page' ? path.basename(path.dirname(path.resolve(page))) : base;
};

export const needsPage = (v, input, verbName) => {
  if (v.aspect === 'all') throw new UsageError(`--aspect all renders every aspect: dev and ship take it, ${verbName} does not`);
  const given = ['param', 'data', 'aspect', 'size'].find((k) => v[k]);
  if (given && !String(input).endsWith('.html')) throw new UsageError(`--${given} goes to a page: ${verbName} was given ${input}`);
};

export const PAGE = { name: 'page', required: true, kind: 'file', help: 'films/<name>/page.html' };
export const ASPECT = 'a W:H ratio of whole numbers (16:9 9:16 1:1 4:5 4:3 are the common ones, 1200:630 and 2:1 work too): overrides the page aspect meta, the page sees it as it sees the meta, and the default output name gets it (-2x1), so two aspects do not overwrite each other';
export const ASPECT_FLAG = { name: 'aspect', type: 'string', default: 'the page meta, else 16:9', help: ASPECT };
export const PARAM = { name: 'param', type: 'string', repeat: true, help: 'a page option key=value, repeatable: the page reads it with new URLSearchParams(location.search), for example --param look=riso. A page only; part of the render key; the default output name gets it (-look-riso), so renders of two looks do not overwrite each other' };
export const DATA = { name: 'data', type: 'path', help: 'a JSON file the page reads as window.VAWE_DATA, set before its scripts run, for example --data films/my-film/data.json. A page only; part of the render key; the default output name gets a short hash of the JSON (-data-1a2b3c4d), so renders of two data files do not overwrite each other. Works with --param' };

export const JSON_RESULT_VERBS = new Set(['dev', 'ship', 'wait']);
export const JSON_FLAG = { name: 'json', type: 'bool', help: 'print the result as one JSON line on stdout and everything else on stderr: {ok, verb, page, out, exitCode, reason, durationSec, frames, warnings, next} (page, out, frames and next are left out when the call has none)' };

/** Adds the render key of --param, --data and --aspect to the env of each step of a verb that takes --param: bin/vawe and bin/vawe-dev both call it. Throws a UsageError for a bad value. */
export function applyRenderEnv(verb, values, steps) {
  if (!steps || !verb.flags.some((f) => f.name === 'param')) return;
  let env;
  try { env = renderEnv(values); } catch (e) { throw e instanceof DataError ? new UsageError(e.message, e.fix) : new UsageError(e.message); }
  for (const step of steps) step.env = { ...step.env, ...env };
}
