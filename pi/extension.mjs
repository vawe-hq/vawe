// pi extension: the vawe tools and the film guard, for pi 1.5.x (@earendil-works/pi-coding-agent). pi loads .mjs without a build step.
// The tools are the MCP server's own handlers, reached through an in-process MCP client, so pi and Claude Code run the same code.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, TOOL_NAMES } from '../harness/mcp/server.mjs';
import { denial } from '../harness/live/film-guard.mjs';

export const PI_VERSION = '1.5.2';

export const VAWE_TOOLS = TOOL_NAMES;

// pi names its built-in tools in lower case with `path`; the guard speaks Claude Code's names with `file_path`.
const GUARDED = { write: 'Write', edit: 'Edit', bash: 'Bash' };

/** `{ block, reason }` for a pi tool call the guard denies, else undefined. Pure. */
export function guardCall(toolName, input = {}) {
  const name = GUARDED[toolName];
  if (!name) return undefined;
  const reason = denial(name, { ...input, file_path: input.path ?? input.file_path }, '');
  return reason ? { block: true, reason } : undefined;
}

const asPiResult = (result) => ({ content: result.content, details: { isError: result.isError === true } });

async function connectVawe(work) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(work ? { work } : undefined).connect(serverSide);
  const client = new Client({ name: 'vawe-pi', version: '1.0.0' });
  await client.connect(clientSide);
  return client;
}

/** Registers the vawe tools on `pi`, each calling the MCP server in this process. Returns the client so a host can close it. */
export async function registerVaweTools(pi, { work } = {}) {
  const client = await connectVawe(work);
  const { tools } = await client.listTools();
  for (const tool of tools) {
    pi.registerTool({
      name: tool.name,
      label: tool.name,
      description: tool.description ?? tool.name,
      parameters: tool.inputSchema,
      async execute(_id, params) {
        return asPiResult(await client.callTool({ name: tool.name, arguments: params }));
      },
    });
  }
  return client;
}

export default async function vawePi(pi) {
  await registerVaweTools(pi);
  pi.on('tool_call', (event) => guardCall(event.toolName, event.input));
}
