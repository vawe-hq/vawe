// The contract of a verb step that bin/vawe runs in-process: the script exports
//   async function run(args, { env, out, err }) -> exit code
// and ends with `runAsMain(import.meta.url, run)` so `node <script> <args>` works as before.
// `out` and `err` write their text verbatim, like process.stdout.write. A step never calls process.exit, reads `env` and not process.env, and starts no child that outlives it.
import { fileURLToPath } from 'node:url';

export const processIo = () => ({
  env: process.env,
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
});

/** Runs `run` with the process argv and io when `metaUrl` is the script node started; sets the exit code. */
export async function runAsMain(metaUrl, run) {
  if (process.argv[1] && fileURLToPath(metaUrl) === process.argv[1]) process.exitCode = await run(process.argv.slice(2), processIo());
}
