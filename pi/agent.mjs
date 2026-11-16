// `vawe agent`: a pi SDK session that has only the vawe tools plus read. API key auth only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import vawePi, { VAWE_TOOLS, PI_VERSION } from './extension.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PI_PACKAGE = '@earendil-works/pi-coding-agent';
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const AGENT_TOOLS = [...VAWE_TOOLS, 'read'];

export const AGENT_HELP = `vawe agent [--model <id>] ["<the ask>"]

A chat session that makes a film only through the vawe tools. It has the vawe tools and read.
It has no shell, no file writer and no editor.

Needs the pi SDK: npm install ${PI_PACKAGE}@${PI_VERSION}
Auth: set ANTHROPIC_API_KEY to an Anthropic API key. Claude subscription login is not offered:
Anthropic's terms keep it for Anthropic's own apps.

  --model <id>   Anthropic model id (default ${DEFAULT_MODEL})
  --help         this text`;

/** The body of agents/vawe.md: the system prompt without its front matter. */
export function agentPrompt(file = path.join(ROOT, 'agents', 'vawe.md')) {
  return fs.readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

/** The options for createAgentSession. `tools` is an allowlist: pi enables only the named tools. */
export function sessionOptions({ cwd, resourceLoader, modelRuntime, model, sessionManager }) {
  return { cwd, resourceLoader, modelRuntime, model, sessionManager, tools: AGENT_TOOLS };
}

/** Builds the session with the pi SDK `sdk`; the vawe tools come in as an inline extension and nothing else loads. */
export async function createVaweSession(sdk, { apiKey, modelId = DEFAULT_MODEL, cwd = process.cwd(), prompt = agentPrompt() }) {
  const agentDir = path.join(os.homedir(), '.vawe', 'pi');
  const modelRuntime = await sdk.ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json') });
  await modelRuntime.setRuntimeApiKey('anthropic', apiKey);
  const model = modelRuntime.getModel('anthropic', modelId);
  if (!model) throw new Error(`no Anthropic model "${modelId}" in pi ${PI_VERSION}; pass --model with an id pi lists`);
  const resourceLoader = new sdk.DefaultResourceLoader({
    cwd,
    agentDir,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: prompt,
    appendSystemPrompt: [],
    extensionFactories: [vawePi],
  });
  await resourceLoader.reload();
  const { session } = await sdk.createAgentSession(sessionOptions({ cwd, resourceLoader, modelRuntime, model, sessionManager: sdk.SessionManager.inMemory(cwd) }));
  await session.bindExtensions({});
  return session;
}

async function loadSdk() {
  try {
    return await import(PI_PACKAGE);
  } catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    throw new Error(`vawe agent needs the pi SDK. Run: npm install ${PI_PACKAGE}@${PI_VERSION}`);
  }
}

function parseArgs(args) {
  const out = { modelId: DEFAULT_MODEL, ask: [], help: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') out.help = true;
    else if (args[i] === '--model') out.modelId = args[++i];
    else out.ask.push(args[i]);
  }
  return out;
}

async function chat(session, firstAsk) {
  session.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') process.stdout.write(event.assistantMessageEvent.delta);
  });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    let ask = firstAsk || await rl.question('vawe> ');
    while (ask.trim()) {
      await session.prompt(ask);
      process.stdout.write('\n');
      ask = await rl.question('vawe> ');
    }
  } finally {
    rl.close();
  }
}

/** Entry of `bin/vawe agent`. Returns the exit code. */
export async function runAgent(args) {
  const { modelId, ask, help } = parseArgs(args);
  if (help) {
    console.log(AGENT_HELP);
    return 0;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('vawe: set ANTHROPIC_API_KEY to an Anthropic API key. Claude subscription login is not offered: Anthropic keeps it for its own apps.');
    return 2;
  }
  const session = await createVaweSession(await loadSdk(), { apiKey, modelId });
  try {
    await chat(session, ask.join(' '));
  } finally {
    session.dispose();
  }
  return 0;
}
