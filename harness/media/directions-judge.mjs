#!/usr/bin/env node
// The concept check inside `vawe dev`: when brief.md holds three filled directions, score directions.html
// with the fresh stills judge, once per change of either (keyed by content in out/<name>.stills.json).
//   node harness/media/directions-judge.mjs <page.html>
// Advises, never blocks: exits 0 when the judge cannot run, and says so.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stillsAction, stillsKey, stillsLines } from '../lib/stills-pick.mjs';
import { adviceBlock } from '../lib/advice.mjs';

const JUDGE = path.resolve(import.meta.dirname, 'judge-fresh.mjs');

const read = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const readJson = (file) => { try { return JSON.parse(read(file)); } catch { return null; } };

function main(page) {
  const dir = path.dirname(path.resolve(page));
  const [briefFile, htmlFile] = [path.join(dir, 'brief.md'), path.join(dir, 'directions.html')];
  const [brief, html] = [read(briefFile), read(htmlFile)];
  const out = path.resolve('out', `${path.basename(dir)}.stills.json`);
  const cached = readJson(out);
  const action = stillsAction({ brief, html, cached });
  if (action === 'skip') return;
  if (action === 'cached') { console.log(stillsLines(cached, { cached: true }).join('\n')); return; }
  console.log('stills judge: scoring the three directions once for this change (about 25 s; --no-judge skips it)');
  const r = spawnSync(process.execPath, [JUDGE, path.relative(process.cwd(), htmlFile), '--stage', 'stills', '--brief', path.relative(process.cwd(), briefFile)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const result = r.status === 0 ? readJson(out) : null;
  if (!result) {
    const why = String(r.stderr || r.stdout || r.error?.message || 'no output').trim().split('\n').at(-1);
    console.log(adviceBlock([`stills judge did not run (${why}); run it yourself: bin/vawe-dev judge ${path.relative(process.cwd(), htmlFile)} --fresh --stage stills --brief ${path.relative(process.cwd(), briefFile)}`]).join('\n'));
    return;
  }
  fs.writeFileSync(out, JSON.stringify({ ...result, key: stillsKey(html, brief) }, null, 1));
  console.log(stillsLines(result).join('\n'));
}

if (!process.argv[2]) { console.error('error: usage: node harness/media/directions-judge.mjs <page.html>'); process.exit(2); }
main(process.argv[2]);
