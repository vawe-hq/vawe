import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { renderPage, resolveFrame, RenderError } from '../../harness/media/render-page.mjs';

test('renderPage rejects with a RenderError for a missing page and leaves the process alive', async () => {
  await assert.rejects(renderPage('/no/such/page.html', '/tmp/never.mp4'), (e) => e instanceof RenderError && /no such file/.test(e.message));
});

test('renderPage rejects --audio from a later second', async () => {
  await assert.rejects(renderPage(fileURLToPath(import.meta.url), '/tmp/never.mp4', { audio: true, from: 1 }), (e) => e instanceof RenderError && /--audio needs a render from 0/.test(e.message));
});

test('resolveFrame throws a RenderError for an unknown aspect', () => {
  assert.throws(() => resolveFrame('x.html', { aspect: 'wide' }), RenderError);
});
