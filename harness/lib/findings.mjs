// THE CLASS HAS ALREADY BITTEN: motion-audit --json printed
import fs from 'node:fs';

const GLYPH = { error: '✗', warn: '~', info: '·' };
const SEVERITIES = new Set(Object.keys(GLYPH));

const jsonMode = process.argv.includes('--json');
const realStdout = process.stdout.write.bind(process.stdout);
const reroute = () => { if (jsonMode) process.stdout.write = process.stderr.write.bind(process.stderr); };

/**
 * gateFindings({ scene, indent, line }) -> an emitter. Named for the caller rather than the fact
 * because half the gates already hold a local `findings` array of their own raw hits, and shadowing
 * that on import is the kind of collision a reader has to untangle at the wrong moment.
 *   .fail / .warn / .note (code, summary, extra?)  record one finding
 *   .finding({ code, severity, scene, at, summary, fix, doc })  the long form
 *   .records                                        what has been recorded
 *   .emit(print?)                                   render: prose to stdout (`print(records)` returns the lines), or JSON under --json
 *
 * `line(record, glyph)` renders ONE record and may return several lines. It exists because the gates
 * do not all print alike and their output must not move; it consumes the record, so the record is still
 * the only statement of the fact.
 */
const ALL = [];
let emitted = false;
const allRecords = () => ALL.flat();

const flush = () => {
  const payload = JSON.stringify(allRecords(), null, 2);
  if (jsonMode) realStdout(payload + '\n');
  const out = process.env.VAWE_FINDINGS_OUT;
  if (out) { try { fs.writeFileSync(out, payload); } catch { /* a side channel must never fail a gate */ } }
};

process.on('exit', () => { if (!emitted && ALL.length) flush(); });

export function gateFindings(opts = {}) {
  const { scene = null, indent = '  ', line = null } = opts;
  const records = [];
  ALL.push(records);
  reroute();

  const add = (severity, code, summary, extra = {}) => {
    if (!SEVERITIES.has(severity)) throw new Error(`findings: unknown severity "${severity}"`);
    if (!code) throw new Error('findings: a finding with no code cannot be routed, waived or ratcheted');
    const { at, fix, doc, waived, ...rest } = extra;
    const rec = {
      code, severity,
      ...(scene ? { scene } : {}),
      ...(at ? { at } : {}),
      summary: String(summary),
      ...(fix ? { fix } : {}),
      ...(doc ? { doc } : {}),
      ...(waived ? { waived: true } : {}),
      ...rest,
    };
    records.push(rec);
    return rec;
  };

  const glyphFor = (r) => (r.waived ? '○' : GLYPH[r.severity]);
  const render = (r) => (line ? line(r, glyphFor(r)) : `${indent}${glyphFor(r)} [${r.code}] ${r.summary}`);

  return {
    records,
    get count() { return records.length; },
    finding: (rec) => add(rec.severity || 'warn', rec.code, rec.summary, (({ code, severity, summary, ...rest }) => rest)(rec)),
    fail: (code, summary, extra) => add('error', code, summary, extra),
    warn: (code, summary, extra) => add('warn', code, summary, extra),
    note: (code, summary, extra) => add('info', code, summary, extra),
    render,
    emit(print = null) {
      emitted = true;
      if (!jsonMode) { if (print) print(records).forEach((l) => console.log(l)); else for (const r of records) console.log(render(r)); }
      flush();
    },
  };
}

/**
 * A gate that already owned `--json` before this module existed keeps its own payload, and prints it
 * through here. eye-trace is the one: its --json is a whole eye-trace report (junctions, debt, the
 * findings inside it), documented and read by people, and replacing it with a bare finding array would
 * be a silent loss dressed up as a contract. What it must NOT do is print that object with console.log,
 * because this module has already pointed stdout at stderr; and it must claim the payload, or the exit
 * flush would append a second document to the same stream. That is exactly the two-writers-one-stdout
 * shape of that bug, so there is one door and this is it.
 */
export function emitJson(value) {
  emitted = true;
  realStdout(JSON.stringify(value, null, 2) + '\n');
}

/** Read back what a gate wrote to VAWE_FINDINGS_OUT. Returns null when the gate wrote nothing. */
export function readFindings(file) {
  try {
    const recs = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(recs) ? recs : null;
  } catch { return null; }
}
