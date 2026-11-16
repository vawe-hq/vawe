import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vawePi, { VAWE_TOOLS, guardCall } from '../../pi/extension.mjs';
import { AGENT_TOOLS, agentPrompt, createVaweSession } from '../../pi/agent.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function fakePi() {
  const tools = [];
  const handlers = {};
  return { tools, handlers, registerTool: (t) => tools.push(t), on: (name, fn) => { handlers[name] = fn; } };
}

test('the extension registers every vawe tool with their schemas', async () => {
  const pi = fakePi();
  await vawePi(pi);
  assert.deepEqual(pi.tools.map((t) => t.name).sort(), [...VAWE_TOOLS].sort());
  for (const t of pi.tools) assert.equal(t.parameters.type, 'object', t.name);
  assert.equal(typeof pi.handlers.tool_call, 'function');
});

test('a registered tool runs the MCP handler and returns its text', async () => {
  const pi = fakePi();
  await vawePi(pi);
  const status = pi.tools.find((t) => t.name === 'vawe_status');
  const result = await status.execute('id', { film: 'no-such-film-for-pi-test' });
  assert.equal(JSON.parse(result.content[0].text).ok, false);
});

test('tool_call blocks a film write and raw ffmpeg, and allows read', async () => {
  const pi = fakePi();
  await vawePi(pi);
  const call = (toolName, input) => pi.handlers.tool_call({ toolName, input });
  const write = call('write', { path: 'films/x/page.html', content: '<p>' });
  assert.equal(write.block, true);
  assert.match(write.reason, /vawe_write_page/);
  assert.doesNotMatch(write.reason, /mcp__/);
  assert.equal(call('edit', { path: 'films/x/brief.md' }).block, true);
  assert.equal(call('bash', { command: 'ffmpeg -i a.mp4 b.mp4' }).block, true);
  assert.equal(call('bash', { command: 'echo hi > films/x/page.html' }).block, true);
  assert.equal(call('read', { path: 'films/x/page.html' }), undefined);
  assert.equal(call('write', { path: 'notes/a.md', content: 'x' }), undefined);
  assert.equal(guardCall('bash', { command: 'ls' }), undefined);
});

test('the agent tool list is the vawe tools plus read, no bash, write or edit', () => {
  assert.deepEqual([...AGENT_TOOLS].sort(), [...VAWE_TOOLS, 'read'].sort());
  for (const banned of ['bash', 'write', 'edit']) assert.ok(!AGENT_TOOLS.includes(banned), banned);
});

test('the agent session is built with that allowlist, the vawe prompt and no ambient resources', async () => {
  const seen = {};
  class ModelRuntime {
    static async create() { return new ModelRuntime(); }
    async setRuntimeApiKey(provider, key) { seen.key = [provider, key]; }
    getModel(provider, id) { return { provider, id }; }
  }
  class DefaultResourceLoader {
    constructor(o) { seen.loader = o; }
    async reload() {}
  }
  const sdk = {
    ModelRuntime,
    DefaultResourceLoader,
    SessionManager: { inMemory: () => 'memory' },
    createAgentSession: async (o) => { seen.session = o; return { session: { bindExtensions: async () => {} } }; },
  };
  await createVaweSession(sdk, { apiKey: 'sk-test', cwd: ROOT });
  assert.deepEqual(seen.key, ['anthropic', 'sk-test']);
  assert.deepEqual(seen.session.tools, AGENT_TOOLS);
  assert.equal(seen.loader.noExtensions, true);
  assert.equal(seen.loader.systemPrompt, agentPrompt());
  assert.equal(seen.loader.extensionFactories[0], vawePi);
});

test('the agent prompt is the body of agents/vawe.md', () => {
  assert.match(agentPrompt(), /^You make one film through the vawe tools/);
  assert.doesNotMatch(agentPrompt(), /^---/);
});

test('package.json declares the pi package and ships its files', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.keywords.includes('pi-package'));
  assert.ok(pkg.files.includes('pi'));
  for (const rel of [...pkg.pi.extensions, ...pkg.pi.skills]) assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
  assert.equal(pkg.peerDependenciesMeta['@earendil-works/pi-coding-agent'].optional, true);
});
