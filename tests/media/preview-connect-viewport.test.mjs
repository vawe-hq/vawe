// Another process that looks for a warm tab must leave the warm tabs of the first process at their viewport: puppeteer's default
// 800x600 landed on every warm tab it listed, so a plan read in parallel saw a quarter-size frame. Launches Chrome in its own job dir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PAGES = path.join(ROOT, 'tests/fixtures/pages');
const SERVER = path.join(ROOT, 'harness/media/preview-server.mjs');

test('looking for a warm tab leaves another process\'s warm tab at its viewport', async () => {
  const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-viewport-'));
  process.env.CLAUDE_JOB_DIR = jobDir;
  const { openPreview, stateFile } = await import(pathToFileURL(SERVER).href);
  const mine = await openPreview(path.join(PAGES, 'slideshow-classic.html'), { width: 1920, height: 1080, final: false, warm: true });
  try {
    await mine.page.goto(mine.url);
    await mine.markWarm();
    const other = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const { openPreview } = await import(${JSON.stringify(pathToFileURL(SERVER).href)});
       const opened = await openPreview(${JSON.stringify(path.join(PAGES, 'seek-canvas.html'))}, { width: 1280, height: 720, final: false, warm: true });
       await opened.close();`], { env: process.env, encoding: 'utf8' });
    assert.equal(other.status, 0, other.stderr);
    assert.equal(await mine.page.evaluate(() => `${innerWidth}x${innerHeight}`), '1920x1080');
  } finally {
    await mine.close();
    try { process.kill(JSON.parse(fs.readFileSync(stateFile(false), 'utf8')).pid); } catch { /* no daemon left */ }
    delete process.env.CLAUDE_JOB_DIR;
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
});
