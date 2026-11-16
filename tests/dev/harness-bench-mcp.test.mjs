import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseStream, countFirstDraft } from '../../harness/dev/harness-bench.mjs';

const T0 = Date.parse('2026-11-17T10:00:00Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();
const mcp = (tool) => `mcp__plugin_vawe-agent_vawe__${tool}`;
const ok = () => JSON.stringify({ ok: true, findings: [], next: 'x' });

function stream(steps, extra = {}) {
  const lines = [];
  steps.forEach(([s, name, input, output], i) => {
    const id = `t${i}`;
    lines.push({ type: 'assistant', timestamp: at(s), ...extra, message: { id: `m${i}`, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
    lines.push({ type: 'user', timestamp: at(s + 1), ...extra, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: output }] }] } });
  });
  return lines.map((l) => JSON.stringify(l)).join('\n');
}

test('MCP vawe tool calls count as the stages and verbs they stand for, and none is a raw film write', async () => {
  const text = stream([
    [1, mcp('vawe_new_film'), { name: 'x', request: 'a sting' }, ok()],
    [5, mcp('vawe_refs'), { action: 'list' }, ok()],
    [8, mcp('vawe_write_doc'), { film: 'x', file: 'DESIGN.md', text: 'design' }, ok()],
    [10, mcp('vawe_write_page'), { film: 'x', html: '<section data-world="a"></section>' }, ok()],
    [15, mcp('vawe_frame'), { film: 'x', mode: 'world' }, ok()],
    [20, mcp('vawe_edit_doc'), { film: 'x', file: 'brief.md', old: 'a', new: '## Ideas\n- one' }, ok()],
    [25, mcp('vawe_frame'), { film: 'x', mode: 'board' }, ok()],
    [30, mcp('vawe_render_draft'), { film: 'x' }, ok()],
  ]);
  const c = await countFirstDraft({ rows: parseStream(text) });
  assert.equal(c.draft, true);
  assert.equal(c.rawFilmWrites, 0);
  assert.deepEqual(c.stagesReached, ['new', 'study', 'design', 'page', 'frames', 'ideas', 'storyboard', 'draft']);
  assert.equal(c.stagesSkipped, 0);
  assert.equal(c.verbCalls, 5);
});

test('a refused render_draft is not a first draft', async () => {
  const refused = JSON.stringify({ ok: false, findings: [{ code: 'refused', message: 'the Ideas ledger is empty' }], next: 'fill it' });
  const c = await countFirstDraft({ rows: parseStream(stream([[1, mcp('vawe_render_draft'), { film: 'x' }, refused]])) });
  assert.equal(c.draft, false);
});

test('the same tools under the --mcp-config server name map too, and a subagent row counts', async () => {
  const text = stream([[1, 'mcp__vawe__vawe_render_draft', { film: 'x' }, ok()]], { parent_tool_use_id: 'toolu_parent' });
  const c = await countFirstDraft({ rows: parseStream(text) });
  assert.equal(c.draft, true);
});

test('tokens are summed over every assistant message, main and subagent, one message once', async () => {
  const msg = (id, out, sub) => ({ type: 'assistant', ...(sub ? { parent_tool_use_id: 'p' } : {}), message: { id, role: 'assistant', content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 2, output_tokens: out, cache_read_input_tokens: 100, cache_creation_input_tokens: 10 } } });
  const rows = [msg('a', 5), msg('a', 9), msg('b', 7, true), msg('c', 3, true), { type: 'result', duration_ms: 1000, usage: { input_tokens: 1, output_tokens: 1 } }];
  const c = await countFirstDraft({ rows: parseStream(rows.map((r) => JSON.stringify(r)).join('\n')) });
  assert.equal(c.output, 9 + 7 + 3);
  assert.equal(c.input, 6);
  assert.equal(c.cacheRead, 300);
});

test('the recorded plugin stream is a first draft with no raw film write', async () => {
  const text = fs.readFileSync(new URL('../fixtures/bench/title-sting-plugin.stream.jsonl', import.meta.url), 'utf8');
  const c = await countFirstDraft({ rows: parseStream(text) });
  assert.equal(c.draft, true);
  assert.equal(c.rawFilmWrites, 0);
  for (const stage of ['design', 'page', 'frames', 'ideas', 'storyboard', 'draft']) assert.ok(c.stagesReached.includes(stage), `${stage} in ${c.stagesReached}`);
  assert.ok(c.output > 300, `output tokens ${c.output} count the subagent`);
});
