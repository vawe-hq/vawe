// Small helpers the verb tables share.
import path from 'node:path';
import { UsageError } from './parse.mjs';
import { renderEnv } from '../lib/page-params.mjs';

export const opt = (flag, value) => (value === undefined ? [] : [flag, String(value)]);

export const pageName = (page) => {
  const base = path.basename(page, '.html');
  return base === 'page' ? path.basename(path.dirname(path.resolve(page))) : base;
};

export const needsPage = (v, input, verbName) => {
  if (v.aspect === 'all') throw new UsageError(`--aspect all renders every aspect: dev and ship take it, ${verbName} does not`);
  const given = ['param', 'aspect', 'size'].find((k) => v[k]);
  if (given && !String(input).endsWith('.html')) throw new UsageError(`--${given} goes to a page: ${verbName} was given ${input}`);
};

export const PAGE = { name: 'page', required: true, kind: 'file', help: 'films/<name>/page.html' };
export const ASPECT = 'a W:H ratio of whole numbers (16:9 9:16 1:1 4:5 4:3 are the common ones, 1200:630 and 2:1 work too): overrides the page aspect meta, the page sees it as it sees the meta, and the default output name gets it (-2x1), so two aspects do not overwrite each other';
export const ASPECT_FLAG = { name: 'aspect', type: 'string', default: 'the page meta, else 16:9', help: ASPECT };
export const PARAM = { name: 'param', type: 'string', repeat: true, help: 'a page option key=value, repeatable: the page reads it with new URLSearchParams(location.search), for example --param look=riso. A page only; part of the render key; the default output name gets it (-look-riso), so renders of two looks do not overwrite each other' };

/** Adds the render key of --param and --aspect to the env of each step of a verb that takes --param: bin/vawe and bin/vawe-dev both call it. Throws a UsageError for a bad value. */
export function applyRenderEnv(verb, values, steps) {
  if (!steps || !verb.flags.some((f) => f.name === 'param')) return;
  let env;
  try { env = renderEnv(values); } catch (e) { throw new UsageError(e.message); }
  for (const step of steps) step.env = { ...step.env, ...env };
}
