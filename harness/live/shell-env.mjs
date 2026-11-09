import fs from 'node:fs';

export const ENV_LINE = 'if [ -n "$ZSH_VERSION" ]; then setopt nonomatch; fi';

export function addNoMatch(envFile) {
  if (!envFile) return false;
  const have = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  if (have.split('\n').includes(ENV_LINE)) return false;
  fs.appendFileSync(envFile, `${ENV_LINE}\n`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { addNoMatch(process.env.CLAUDE_ENV_FILE); } catch {}
}
