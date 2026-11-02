// vawe-dev runs <film> | --all | --taste [--json] [--dir out]: reads <dir>/<film>.runs.jsonl (harness/lib/runlog.mjs) into tables (harness/lib/runs-report.mjs).
import { readAllRuns, filmKeyOf } from '../lib/runlog.mjs';
import { filmLines, allRows, modelRows, allLines, allPhaseMedians } from '../lib/runs-report.mjs';
import { tasteReport, tasteLines } from '../lib/taste-report.mjs';
import { metaReader } from '../lib/variety.mjs';
import RULES from '../../taste/build/rules.json' with { type: 'json' };
import path from 'node:path';
import { lastFailedShip, failedShipLine } from '../lib/ship-status.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const dirAt = args.indexOf('--dir');
const dir = dirAt >= 0 ? args[dirAt + 1] : 'out';
const film = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--dir');

if (args.includes('--taste')) {
  const report = tasteReport(readAllRuns(dir), { ruleIds: Object.keys(RULES), readMeta: metaReader(path.resolve(dir, '..')) });
  console.log(json ? JSON.stringify(report, null, 1) : tasteLines(report).join('\n'));
} else if (args.includes('--all')) {
  const films = readAllRuns(dir);
  const rows = allRows(films, Date.now());
  const phases = allPhaseMedians(films, Date.now());
  console.log(json ? JSON.stringify({ films: rows, models: modelRows(rows), phases }, null, 1) : allLines(rows, modelRows(rows), phases).join('\n'));
} else if (film) {
  const key = filmKeyOf(film);
  const runs = readAllRuns(dir).find((f) => f.film === key)?.runs ?? [];
  console.log(json ? JSON.stringify(runs, null, 1) : filmLines(key, runs).join('\n'));
  const failed = lastFailedShip(runs);
  if (failed && !json) console.error(failedShipLine(key, failed));
} else {
  console.error('vawe-dev runs: give a film name, --all or --taste');
  process.exit(2);
}
