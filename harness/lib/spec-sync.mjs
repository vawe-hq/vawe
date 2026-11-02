// The brief's Words appear/settle cells, Objects in/settle/out cells and Shots start/end/ground cells rewritten from
// what the last draft measured (the `spec` of out/<name>.acceptance.json, measuredSpec in spec-conformance.mjs). Text,
// shot and the target cells (cap, x, y) stay. A time cell that changed ends in `*`; the next sync clears the mark. Pure.
import { tableRows, numberOf, cellsOf } from './brief-tables.mjs';

const MARK = '*';
const SAME_S = 0.005;
const KEY = { Words: 'text', Shots: 'id', Objects: 'id' };

const cellsToLine = (cells) => `| ${cells.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`;

function newCell(old, value) {
  const text = old.replace(/^`+|`+$/g, '').replace(/\*$/, '').trim();
  const before = numberOf(text);
  const unit = /\s*s$/.test(text) ? ' s' : '';
  const next = `${+value.toFixed(2)}${unit}`;
  return before !== null && Math.abs(before - value) <= SAME_S ? { cell: old.replace(/\s*\*$/, ''), changed: false } : { cell: `${next}${MARK}`, changed: true, from: text };
}

function syncTable(lines, name, keyOf, fields, measured) {
  const changes = [];
  const missing = [];
  const used = new Set();
  for (const { line, cells, row, index } of tableRows(lines, name)) {
    const found = measured.find((m) => !used.has(m) && keyOf(m).toLowerCase() === String(row[KEY[name]]).toLowerCase());
    if (!found) { missing.push(`${name} "${row[KEY[name]]}"`); continue; }
    used.add(found);
    const next = [...cells];
    for (const f of fields) {
      const i = index[f];
      if (i < 0 || found[f] == null || row[f] === null) continue;
      const { cell, changed, from } = newCell(cells[i] ?? '', found[f]);
      next[i] = cell;
      if (changed) changes.push(`${name} "${row[KEY[name]]}" ${f}: ${from} -> ${cell.slice(0, -1)}`);
    }
    if (next.some((c, i) => c !== cells[i])) lines[line] = cellsToLine(next);
  }
  return { changes, missing };
}

function addGroundColumn(lines, header) {
  const head = lines.findIndex((l) => /^#{2,4}\s+Shots\s*$/i.test(l.trim()));
  const at = lines.findIndex((l, i) => i > head && l.trim().startsWith('|'));
  lines[at] = cellsToLine([...header, 'ground']);
  lines[at + 1] = cellsToLine([...cellsOf(lines[at + 1]), '---']);
}

function syncGround(lines, worlds) {
  const rows = tableRows(lines, 'Shots').map((r) => ({ ...r, world: worlds.find((w) => w.id.toLowerCase() === r.row.id.toLowerCase()) })).filter((r) => r.world?.ground);
  if (!rows.length) return;
  const head = lines.findIndex((l) => /^#{2,4}\s+Shots\s*$/i.test(l.trim()));
  const headerAt = lines.findIndex((l, i) => i > head && l.trim().startsWith('|'));
  const header = cellsOf(lines[headerAt]);
  let ground = rows[0].index.ground;
  if (ground < 0) { ground = header.length; addGroundColumn(lines, header); }
  for (const { line, cells, world } of rows) {
    const next = [...cells, ...Array(Math.max(0, ground - cells.length)).fill('')];
    next[ground] = world.ground;
    lines[line] = cellsToLine(next);
  }
}

/** { text, changes, missing }: the brief text with the measured times written in, the changed cells as lines, the rows no measure matched. */
export function syncSpec(briefText, measured) {
  const lines = briefText.split('\n');
  const worlds = measured.worlds ?? [];
  const tables = [
    syncTable(lines, 'Words', (m) => m.text, ['appear', 'settle'], measured.words),
    syncTable(lines, 'Objects', (m) => m.id, ['in', 'settle', 'out'], measured.objects),
    ...(worlds.length ? [syncTable(lines, 'Shots', (m) => m.id, ['start', 'end'], worlds)] : []),
  ];
  if (worlds.length) syncGround(lines, worlds);
  return { text: lines.join('\n'), changes: tables.flatMap((t) => t.changes), missing: tables.flatMap((t) => t.missing) };
}
