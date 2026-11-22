import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain } from '../../harness/lib/is-main.mjs';

const HELPER = new URL('../../harness/lib/is-main.mjs', import.meta.url).href;

// A folder with a space, the shape `file://${process.argv[1]}` never matched on any OS (and no Windows path ever matched).
function scripts() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe is main '));
  fs.writeFileSync(path.join(dir, 'cli.mjs'), `import { isMain } from '${HELPER}';\nconsole.log(isMain(import.meta.url) ? 'main' : 'imported');\n`);
  fs.writeFileSync(path.join(dir, 'host.mjs'), "import './cli.mjs';\n");
  return dir;
}

const run = (file) => spawnSync(process.execPath, [file], { encoding: 'utf8' }).stdout.trim();

test('isMain is true for the script node started and false for a module it imports', () => {
  const dir = scripts();
  try {
    assert.equal(run(path.join(dir, 'cli.mjs')), 'main');
    assert.equal(run(path.join(dir, 'host.mjs')), 'imported');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('isMain is true for a script started through a symlink (npm link, a global bin)', (t) => {
  const dir = scripts();
  try {
    const link = path.join(dir, 'linked.mjs');
    try { fs.symlinkSync(path.join(dir, 'cli.mjs'), link); } catch (e) { t.skip(`no symlink here: ${e.code}`); return; }
    assert.equal(run(link), 'main');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('isMain compares the file URL of a path, never the raw path', () => {
  const file = fileURLToPath(HELPER);
  assert.equal(isMain(pathToFileURL(file).href, file), true);
  assert.equal(isMain(`file://${file}`, file), process.platform !== 'win32' && !file.includes(' '));
  assert.equal(isMain(pathToFileURL(file).href, undefined), false);
});
