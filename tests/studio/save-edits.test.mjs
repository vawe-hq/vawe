import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEditor } from '../../studio/save-edits.mjs';

const PAGE = '<div style="color: red; background: white"></div>';
const swap = (src, from, to) => { const at = src.indexOf(from); return [{ start: at, end: at + from.length, expect: from, text: to }]; };

function withPage(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-edit-'));
  const file = path.join(dir, 'page.html');
  fs.writeFileSync(file, PAGE);
  return Promise.resolve(fn(file)).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

test('undo refuses, and keeps the file, when the page changed after the last studio edit', () => withPage(async (file) => {
  const editor = createEditor(file);
  await editor.save(swap(PAGE, 'red', 'blue'), async () => 'ok');
  const agentEdit = fs.readFileSync(file, 'utf8').replace('white', 'black');
  fs.writeFileSync(file, agentEdit);
  await assert.rejects(editor.undo(), /page changed after the last studio edit/);
  assert.equal(fs.readFileSync(file, 'utf8'), agentEdit);
  assert.equal(editor.depth(), 0);
}));

test('undo restores the page when nothing else changed it', () => withPage(async (file) => {
  const editor = createEditor(file);
  await editor.save(swap(PAGE, 'red', 'blue'), async () => 'ok');
  await editor.save(swap(fs.readFileSync(file, 'utf8'), 'white', 'black'), async () => 'ok');
  await editor.undo();
  assert.equal(fs.readFileSync(file, 'utf8'), PAGE.replace('red', 'blue'));
  await editor.undo();
  assert.equal(fs.readFileSync(file, 'utf8'), PAGE);
  await assert.rejects(editor.undo(), /nothing to undo/);
}));

test('a rejected save does not erase a second save sent while its check ran', () => withPage(async (file) => {
  const editor = createEditor(file);
  let release;
  const slowReject = () => new Promise((_, reject) => { release = () => reject(new Error('bad page')); });
  const first = editor.save(swap(PAGE, 'red', 'blue'), slowReject);
  const second = editor.save(swap(PAGE, 'white', 'black'), async () => 'ok');
  await new Promise((r) => setTimeout(r, 20));
  release();
  await assert.rejects(first, /bad page/);
  await second;
  assert.equal(fs.readFileSync(file, 'utf8'), PAGE.replace('white', 'black'));
  assert.equal(editor.depth(), 1);
}));
