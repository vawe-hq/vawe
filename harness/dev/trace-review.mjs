// harness/dev/trace-review.mjs: the one tool that reads agent transcripts (Claude Code JSONL) and says what each agent did,
// what failed, what cost most and which rules the trace shows broken, so a framework change can be measured.
//   node harness/dev/trace-review.mjs <transcript.jsonl | dir> ...        one report per agent, then the aggregate table
//   node harness/dev/trace-review.mjs --project <dir> [--since <date|sha>] [--films | --authors] [--agent <id|label>] [--main]
//   flags: --films        only film agents: wrote films/<name>/page.html or ran bin/vawe new for a real film (not zz-*, probes, trials) and ran dev
//          --authors      only film agents that started their film with bin/vawe new (not a resume, merge or engine task)
//          --since X      only agents that started on or after X (an ISO date or a commit sha)
//          --agent X      only agents whose id or VAWE_AGENT label contains X
//          --main         with --project, read the main sessions too (default: sub-agent transcripts only)
//          --compare X    the aggregate table before and after X (date or commit sha), to measure a change
//          --aggregate-only   skip the per-agent reports
//          --handmade     instead of the reports: the 15 most repeated hand-made commands (raw ffmpeg, Python or node -e image code, throwaway scripts), each with the verb that covers it
//          --json         every field as JSON, for other scripts
// Verb footers (ok, FAILED, seconds) exist in transcripts from 2026-10-09; earlier verb calls have no exit status.
// Transcripts are streamed line by line. Commands and results are redacted (keys, tokens, long opaque strings).
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { rowsOf, cutoffMs, transcriptFiles } from '../lib/trace/read.mjs';
import { foldRows } from '../lib/trace/fold.mjs';
import { readRunLog } from '../lib/trace/runlog.mjs';
import { analyze } from '../lib/trace/analyze.mjs';
import { selectAgents } from '../lib/trace/select.mjs';
import { aggregate, compareAt } from '../lib/trace/aggregate.mjs';
import { handmadeShapes, rankShapes, coveringVerb } from '../lib/trace/handmade.mjs';
import { brief } from '../lib/trace/redact.mjs';
import { agentMarkdown, aggregateMarkdown, compareMarkdown } from '../lib/trace/report.mjs';

const OPTIONS = {
  project: { type: 'string' }, since: { type: 'string' }, agent: { type: 'string' }, compare: { type: 'string' },
  films: { type: 'boolean' }, authors: { type: 'boolean' }, main: { type: 'boolean' }, json: { type: 'boolean' }, 'aggregate-only': { type: 'boolean' }, handmade: { type: 'boolean' },
};

async function review(file) {
  return analyze(await foldRows(rowsOf(file)), file, (film, meta) => readRunLog(film, { cwd: meta.cwd, session: meta.session }));
}

const TOP_SHAPES = 15;

async function handmadeEvents(file, keep) {
  const fold = await foldRows(rowsOf(file));
  const agent = analyze(fold, file);
  return keep(agent) ? handmadeShapes(fold.calls, { session: agent.session, films: agent.films }) : [];
}

const shapeLine = (r) => `${r.count}x  ${brief(r.shape, 120)}  films: ${r.films.join(',') || '-'}  ${coveringVerb(r.sample) ?? 'no verb'}`;

// The verb table imports harness/lib/findings.mjs, which sends process.stdout to stderr under --json: write to fd 1 directly.
const print = (text) => fs.createWriteStream(null, { fd: 1 }).end(`${text}\n`);

async function main() {
  const { values, positionals } = parseArgs({ options: OPTIONS, allowPositionals: true });
  if (!positionals.length && !values.project) {
    console.error('usage: node harness/dev/trace-review.mjs <transcript.jsonl | dir> ... | --project <dir> [--since X] [--films | --authors] [--agent X] [--compare X] [--json]');
    process.exit(2);
  }
  const sinceMs = cutoffMs(values.since);
  const files = transcriptFiles({ inputs: positionals, project: values.project, sinceMs, main: values.main });
  if (values.handmade) {
    if (values.compare) {
      console.error('trace-review: --handmade does not take --compare');
      process.exit(2);
    }
    const keep = (a) => selectAgents([a], { films: values.films, authors: values.authors, agent: values.agent, sinceMs }).length > 0;
    const events = [];
    for (const file of files) events.push(...await handmadeEvents(file, keep));
    const top = rankShapes(events).slice(0, TOP_SHAPES);
    if (values.json) print(JSON.stringify(top.map((r) => ({ ...r, verb: coveringVerb(r.sample) })), null, 1));
    else print(top.length ? top.map(shapeLine).join('\n') : 'no hand-made commands found');
    return;
  }
  const all = [];
  for (const file of files) all.push(await review(file));
  const agents = selectAgents(all, { films: values.films, authors: values.authors, agent: values.agent, sinceMs });
  const agg = aggregate(agents);
  const compared = values.compare ? compareAt(agents, cutoffMs(values.compare)) : null;
  if (values.json) {
    print(JSON.stringify({ files: files.length, agents, aggregate: agg, compare: compared }, null, 1));
    return;
  }
  const parts = [`${files.length} transcripts read, ${agents.length} agents kept`];
  if (!values['aggregate-only']) parts.push(...agents.map(agentMarkdown));
  parts.push(aggregateMarkdown(agg));
  if (compared) parts.push(compareMarkdown(compared, values.compare));
  print(parts.join('\n\n'));
}

main().catch((e) => { console.error(`trace-review: ${e.message}`); process.exit(1); });
