// Small helpers the verb tables share.
import path from 'node:path';
import { UsageError } from './parse.mjs';

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
