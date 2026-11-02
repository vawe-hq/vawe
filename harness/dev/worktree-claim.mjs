#!/usr/bin/env node
import { addClaim, removeClaim } from '../lib/worktree-claims.mjs';

const [cmd, name, ...rest] = process.argv.slice(2);
if (!cmd || !name) { console.error('usage: bin/vawe-dev claim add|rm <name> [branch] [scope ...]'); process.exit(2); }

if (cmd === 'rm') { removeClaim(name); process.exit(0); }
if (cmd !== 'add') { console.error(`unknown command: ${cmd}`); process.exit(2); }

const [branch, ...scopes] = rest;
const overlaps = addClaim(name, { branch: branch || null, scopes });
if (overlaps.length) {
  console.warn(`\n⚠ ${name} declares a scope another live worktree also claims. Overlap is sometimes`);
  console.warn(`  correct (a read, a doc both touch); this warns, it does not block.`);
  for (const o of overlaps) console.warn(`    ${o.glob}  overlaps  ${o.against} (${o.branch || 'no branch'}): ${o.theirGlob}`);
}
