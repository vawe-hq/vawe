// quality/gates/rule-length.mjs · how many rules, across the agent-facing surface, run over the
// convention length, and does that count only fall?
//
//   node quality/gates/rule-length.mjs            ·   vawe-dev check rule-length
//   node quality/gates/rule-length.mjs --list     ·   every over-length rule found
//   node quality/gates/rule-length.mjs --stamp    ·   record today's count as the new ceiling
//
// WHY THIS EXISTS. A rule in AGENTS.md, a skill, or a guides doc grows one line at a time, and
// nothing counted the standing total, so the library could drift back up unnoticed.
// This is that count, ratcheted the same way `threshold-provenance.mjs` ratchets its own worklist: a
// FAIL tier gate is a wall, and Task 2 of the rules-agents-can-read plan did not, and was never meant
// to, fix every long rule in one pass.
//
// THE LENGTH IS A FORMATTING CONVENTION, NOT A QUALITY THRESHOLD, and it is deliberately absent from
// `threshold-provenance.mjs`'s sourceless-constant worklist for that reason: it does not decide whether
// a FILM passes or fails, only whether a rule is likely to survive a truncating filter unread
// (guides/WRITING-FOR-AGENTS.md, pattern 6). `harness/lib/rule-length.mjs` is the one
// place `RULE_LENGTH_LIMIT` is defined, and its own comment says why 500 was chosen; nothing here
// re-derives it.
//
// Pure: reads doc files. No render, no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';
import { isAgentDoc, longestRule, ruleUnits, RULE_LENGTH_LIMIT } from '../../harness/lib/rule-length.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RATCHET = path.join(ROOT, 'quality/baselines/rule-length-ratchet.json');

function agentDocFiles() {
  const out = ['AGENTS.md'];
  for (const d of fs.readdirSync(path.join(ROOT, 'skills'))) {
    const rel = `skills/${d}/SKILL.md`;
    if (isAgentDoc(rel) && fs.existsSync(path.join(ROOT, rel))) out.push(rel);
  }
  for (const dir of ['guides', 'taste/craft']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      const rel = `${dir}/${f}`;
      if (isAgentDoc(rel)) out.push(rel);
    }
  }
  return out;
}

export function run() {
  const files = agentDocFiles();
  const overLong = [];
  for (const rel of files) {
    const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const units = ruleUnits(body.replace(/^---\n[\s\S]*?\n---\n/, ''));
    for (const u of units) {
      if (u.length > RULE_LENGTH_LIMIT) overLong.push({ file: rel, length: u.length, excerpt: u.slice(0, 90) });
    }
  }
  return { files, overLong, count: overLong.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const r = run();
  const list = process.argv.includes('--list');
  const f = gateFindings({ line: (rec) => rec.summary });

  if (list) {
    console.log(`── the over-length worklist · ${r.count} rule(s) over ${RULE_LENGTH_LIMIT} characters\n`);
    for (const o of r.overLong.sort((a, b) => b.length - a.length)) {
      console.log(`   ${o.file}  ${o.length}c  "${o.excerpt}…"`);
    }
    console.log(`\n  Rewrite, never truncate. guides/WRITING-FOR-AGENTS.md has the shape.\n`);
    process.exit(0);
  }

  console.log(`── rule length · ${r.count} rule(s) over ${RULE_LENGTH_LIMIT} characters across ${r.files.length} agent-facing doc(s)`);
  console.log(`\n   the over-length worklist: node quality/gates/rule-length.mjs --list`);

  const prior = (() => { try { return JSON.parse(fs.readFileSync(RATCHET, 'utf8')); } catch { return null; } })();
  if (process.argv.includes('--stamp')) {
    fs.mkdirSync(path.dirname(RATCHET), { recursive: true });
    fs.writeFileSync(RATCHET, `${JSON.stringify({ overLong: r.count }, null, 1)}\n`);
    console.log(`\n  ✓ ratchet stamped at ${r.count} over-length rule(s)${prior ? `, ${r.count <= prior.overLong ? 'down' : 'UP'} from ${prior.overLong}` : ''}\n`);
    f.emit();
  } else if (prior && r.count > prior.overLong) {
    f.fail('rule-length-ratchet',
      `${r.count} rule(s) in an agent-facing doc run over ${RULE_LENGTH_LIMIT} characters, up from ${prior.overLong}. ` +
      'This is a formatting convention, not a quality bar: a long rule is not wrong, only likely to be ' +
      'read past its truncation point (guides/WRITING-FOR-AGENTS.md, pattern 6). ' +
      'Rewrite, never truncate: split rule / reason / mechanism, keep every fact. ' +
      'node quality/gates/rule-length.mjs --list names each one. ' +
      'If the new length is deliberate, raise the bar on purpose: node quality/gates/rule-length.mjs --stamp');
    console.error();
    f.emit();
    process.exit(1);
  } else if (prior && r.count < prior.overLong) {
    console.log(`\n  ~ ${prior.overLong - r.count} fewer over-length rule(s) than the ratchet allows. Lower it:`
      + ' node quality/gates/rule-length.mjs --stamp');
  } else if (!prior) {
    console.log('\n  no ratchet baseline yet: node quality/gates/rule-length.mjs --stamp');
  } else {
    console.log('\n  ✓ at the ratchet');
  }
  console.log('');
}
