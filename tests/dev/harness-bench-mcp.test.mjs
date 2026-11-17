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

test('tokens come from the result row model totals, not the partial streamed rows', async () => {
  const msg = (id, out) => ({ type: 'assistant', message: { id, role: 'assistant', content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 2, output_tokens: out } } });
  const modelUsage = { main: { inputTokens: 6, outputTokens: 100, cacheReadInputTokens: 300, cacheCreationInputTokens: 10 }, sub: { inputTokens: 4, outputTokens: 900, cacheReadInputTokens: 700, cacheCreationInputTokens: 20 } };
  const rows = [msg('a', 5), msg('b', 7), { type: 'result', duration_ms: 2500, num_turns: 4, total_cost_usd: 1.25, usage: { input_tokens: 6, output_tokens: 100 }, modelUsage }];
  const c = await countFirstDraft({ rows: parseStream(rows.map((r) => JSON.stringify(r)).join('\n')) });
  assert.equal(c.output, 1000);
  assert.equal(c.input, 10);
  assert.equal(c.cacheRead, 1000);
  assert.equal(c.cacheWrite, 30);
  assert.equal(c.costUsd, 1.25);
  assert.equal(c.turns, 4);
  assert.equal(c.wallS, 2.5);
});

test('a real trimmed stream: output counts the subagent, not the main thread alone', async () => {
  const text = fs.readFileSync(new URL('../fixtures/bench/title-sting-subagent.stream.jsonl', import.meta.url), 'utf8');
  const c = await countFirstDraft({ rows: parseStream(text) });
  assert.equal(c.output, 1542 + 12434);
  assert.equal(c.costUsd, 0.8104424000000001);
  assert.equal(c.turns, 5);
});

test('the recorded plugin stream is a first draft with no raw film write', async () => {
  const text = fs.readFileSync(new URL('../fixtures/bench/title-sting-plugin.stream.jsonl', import.meta.url), 'utf8');
  const c = await countFirstDraft({ rows: parseStream(text) });
  assert.equal(c.draft, true);
  assert.equal(c.rawFilmWrites, 0);
  for (const stage of ['design', 'page', 'frames', 'ideas', 'storyboard', 'draft']) assert.ok(c.stagesReached.includes(stage), `${stage} in ${c.stagesReached}`);
  assert.equal(c.output, 1616 + 12268, 'the old stream carries model_usage_since_last_result');
  assert.ok(c.costUsd > 0 && c.turns > 0);
});
