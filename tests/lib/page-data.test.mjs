// `--data file.json`: the canonical JSON, the file name slug, the approval key, the page script and the errors.
//   node --test tests/lib/page-data.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonicalJson, dataScript, dataValue, dataKey, DataError, paramsFilm, paramsFlags, renderEnv, DATA_ENV, DATA_FILE_ENV, PARAMS_ENV } from '../../harness/lib/page-params.mjs';
import { approvalPath } from '../../harness/lib/approval.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { applyRenderEnv } from '../../harness/cli/helpers.mjs';
import { UsageError } from '../../harness/cli/parse.mjs';

const PAGE = 'films/my-film/page.html';
const withFile = (text, fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-data-'));
  const file = path.join(dir, 'd.json');
  fs.writeFileSync(file, text);
  try { return fn(file); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

test('canonicalJson sorts keys at every depth and keeps array order', () => {
  assert.equal(canonicalJson({ b: 1, a: { z: [3, { y: 1, x: 2 }], c: null } }), '{"a":{"c":null,"z":[3,{"x":2,"y":1}]},"b":1}');
});

test('two files that differ in key order and white space share one key; another value gets another', () => {
  const key = (text) => withFile(text, (f) => dataKey({ [DATA_ENV]: dataValue(f) }));
  assert.equal(key('{"a":1,"b":2}'), key('{\n  "b": 2,\n  "a": 1\n}'));
  assert.notEqual(key('{"a":1,"b":2}'), key('{"a":1,"b":3}'));
  assert.match(key('{"a":1}'), /^[0-9a-f]{8}$/);
});

test('the data is part of the film name and of the approval path, next to the params', () => {
  const env = withFile('{"a":1}', (f) => renderEnv({ param: ['look=riso'], data: f }));
  const key = dataKey(env);
  assert.equal(paramsFilm('my-film', env), `my-film-look-riso_data-${key}`);
  assert.equal(paramsFilm('my-film', { [DATA_ENV]: env[DATA_ENV] }), `my-film-data-${key}`);
  assert.equal(paramsFilm('my-film', {}), 'my-film');
  const had = { ...process.env };
  Object.assign(process.env, env);
  try {
    assert.equal(approvalPath(PAGE), path.join('out', `my-film-look-riso_data-${key}.approved`));
  } finally {
    for (const k of [PARAMS_ENV, DATA_ENV, DATA_FILE_ENV]) if (had[k] === undefined) delete process.env[k]; else process.env[k] = had[k];
  }
});

test('paramsFlags puts --data back on a printed command', () => {
  assert.equal(paramsFlags({ [PARAMS_ENV]: 'a=1', [DATA_FILE_ENV]: '/x/d.json' }), ' --param a=1 --data /x/d.json');
});

test('renderEnv without --data sets no data keys', () => {
  assert.deepEqual(renderEnv({ param: ['a=1'] }), { [PARAMS_ENV]: 'a=1' });
});

test('dataScript sets window.VAWE_DATA and cannot close an inline script', () => {
  assert.equal(dataScript({}), '');
  const script = dataScript({ [DATA_ENV]: canonicalJson({ t: '</script><b>' }) });
  assert.ok(!script.includes('</script>'));
  const window = {};
  new Function('window', script)(window);
  assert.deepEqual(window.VAWE_DATA, { t: '</script><b>' });
});

test('a missing file and bad JSON are DataErrors with a fix line', () => {
  assert.throws(() => dataValue('/no/such/file.json'), (e) => e instanceof DataError && /no such file/.test(e.message) && Boolean(e.fix));
  withFile('{"a": ', (f) => assert.throws(() => dataValue(f), (e) => e instanceof DataError && /not valid JSON/.test(e.message) && Boolean(e.fix)));
});

test('every verb that takes --param takes --data, and a bad file is a UsageError with a fix', () => {
  for (const verb of VERBS.filter((v) => v.flags.some((f) => f.name === 'param'))) assert.ok(verb.flags.some((f) => f.name === 'data'), `${verb.name} has no --data`);
  const dev = VERBS.find((v) => v.name === 'dev');
  const steps = [{ script: 'x' }];
  assert.throws(() => applyRenderEnv(dev, { data: '/no/such/file.json' }, steps), (e) => e instanceof UsageError && e.exitCode === 2 && Boolean(e.fix));
  withFile('{"a":1}', (f) => {
    applyRenderEnv(dev, { data: f, param: ['look=riso'] }, steps);
    assert.equal(steps[0].env[DATA_ENV], '{"a":1}');
    assert.equal(steps[0].env[PARAMS_ENV], 'look=riso');
  });
});
