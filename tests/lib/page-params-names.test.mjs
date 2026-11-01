// Every per-film file, job and command takes the params into account, so two looks of one page never share one.
//   node --test tests/lib/page-params-names.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { paramsFilm, paramsFlags, paramsQuery, PARAMS_ENV } from '../../harness/lib/page-params.mjs';
import { approvalPath, fullDraftPath, approveProblem } from '../../harness/lib/approval.mjs';
import { createChecks } from '../../harness/lib/check-runner.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { UsageError } from '../../harness/cli/parse.mjs';
import { resumeLine } from '../../harness/media/render-page.mjs';
import { compareOut } from '../../harness/media/compare-frames.mjs';

const PAGE = 'films/my-film/page.html';
const verb = (name) => VERBS.find((v) => v.name === name);
const withParams = (query, fn) => {
  const had = process.env[PARAMS_ENV];
  process.env[PARAMS_ENV] = query;
  try { return fn(); } finally { if (had === undefined) delete process.env[PARAMS_ENV]; else process.env[PARAMS_ENV] = had; }
};

test('paramsFilm adds the params to the film name, and paramsFlags puts them back on a command', () => {
  assert.equal(paramsFilm('my-film', {}), 'my-film');
  assert.equal(paramsFilm('my-film', { [PARAMS_ENV]: 'look=riso' }), 'my-film-look-riso');
  assert.equal(paramsFlags({}), '');
  assert.equal(paramsFlags({ [PARAMS_ENV]: 'a=1&look=riso' }), ' --param a=1 --param look=riso');
});

test('a key given twice is refused', () => {
  assert.throws(() => paramsQuery(['look=a', 'look=b']), /--param look is given twice/);
});

test('the draft checks of two looks are stored in two files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-checks-'));
  const cwd = process.cwd();
  const page = path.join(cwd, 'tests/fixtures/pages/param-look.html');
  process.chdir(dir);
  try {
    const save = async (query) => {
      const checks = withParams(query, () => createChecks({ pagePath: page }));
      await checks.run('probe', () => 1);
      checks.save();
    };
    await save('');
    await save('look=riso');
    assert.deepEqual(fs.readdirSync(path.join(dir, 'out')).sort(), ['param-look-look-riso.checks.json', 'param-look.checks.json']);
  } finally { process.chdir(cwd); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the approval and the full draft belong to one param set', () => {
  assert.equal(fullDraftPath(PAGE), path.join('out', 'my-film-draft.mp4'));
  assert.equal(approvalPath(PAGE), path.join('out', 'my-film.approved'));
  withParams('look=riso', () => {
    assert.equal(fullDraftPath(PAGE), path.join('out', 'my-film-look-riso-draft.mp4'));
    assert.equal(approvalPath(PAGE), path.join('out', 'my-film-look-riso.approved'));
    assert.match(approveProblem(PAGE, { root: os.tmpdir() }), /no full draft/);
  });
});

test('the next step after a ship names the param-aware file and keeps the flags', () => {
  const next = verb('ship').next({ wait: true, param: ['look=riso'] }, [PAGE]);
  assert.match(next, /out\/my-film-look-riso\.mp4/);
});

test('frame refuses --param for an mp4 or a folder, one frame and a sheet alike', () => {
  assert.throws(() => verb('frame').build({ at: '1', param: ['look=riso'] }, ['out/a.mp4']), UsageError);
  assert.throws(() => verb('frame').build({ param: ['look=riso'] }, ['out/a.mp4']), UsageError);
  assert.doesNotThrow(() => verb('frame').build({ at: '1', param: ['look=riso'] }, [PAGE]));
});

test('the resume hint and the compare sheet keep the params', () => {
  withParams('look=riso', () => {
    assert.match(resumeLine('/tmp/frames', PAGE), /bin\/vawe ship films\/my-film\/page\.html --param look=riso resumes it/);
    assert.equal(compareOut(PAGE), path.join('out', 'compare-page-look-riso.png'));
  });
  assert.equal(compareOut(PAGE), path.join('out', 'compare-page.png'));
});
