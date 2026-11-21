// A zip of a folder, written by streaming each file: store for media (ProRes and wav do not shrink), deflate for text, and the
// ZIP64 records (APPNOTE.TXT 4.5.3, 4.3.14) once an entry, an offset or the entry count passes the 32-bit limits, so a long film's
// layers past 4 GB still open. Fixed timestamps and sorted names: the same folder gives the same bytes.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const LIMIT32 = 0xffffffff;
const LIMIT16 = 0xffff;
const CHUNK = 1 << 20;
const DOS_TIME = 0;
const DOS_DATE = (20 << 9) | (1 << 5) | 1;
const UTF8_FLAG = 0x0800;
const DEFLATE_EXT = new Set(['.txt', '.xml', '.jsx', '.json', '.md', '.html', '.csv']);

/** Every file under `dir` as a path relative to it with forward slashes, sorted. */
export function listFiles(dir, rel = '') {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(dir, path.join(rel, e.name)) : [path.join(rel, e.name).split(path.sep).join('/')]))
    .sort();
}

function crcOf(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(CHUNK);
  let crc = 0;
  try {
    for (let n; (n = fs.readSync(fd, buf, 0, CHUNK, null)) > 0;) crc = zlib.crc32(buf.subarray(0, n), crc);
  } finally { fs.closeSync(fd); }
  return crc;
}

function zip64Extra(fields) {
  const extra = Buffer.alloc(4 + 8 * fields.length);
  extra.writeUInt16LE(0x0001, 0);
  extra.writeUInt16LE(8 * fields.length, 2);
  fields.forEach((v, i) => extra.writeBigUInt64LE(BigInt(v), 4 + 8 * i));
  return extra;
}

function localHeader(entry, limit) {
  const big = entry.size >= limit || entry.packed >= limit;
  const name = Buffer.from(entry.name, 'utf8');
  const extra = big ? zip64Extra([entry.size, entry.packed]) : Buffer.alloc(0);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0);
  h.writeUInt16LE(big ? 45 : 20, 4);
  h.writeUInt16LE(UTF8_FLAG, 6);
  h.writeUInt16LE(entry.method, 8);
  h.writeUInt16LE(DOS_TIME, 10);
  h.writeUInt16LE(DOS_DATE, 12);
  h.writeUInt32LE(entry.crc >>> 0, 14);
  h.writeUInt32LE(big ? LIMIT32 : entry.packed, 18);
  h.writeUInt32LE(big ? LIMIT32 : entry.size, 22);
  h.writeUInt16LE(name.length, 26);
  h.writeUInt16LE(extra.length, 28);
  return Buffer.concat([h, name, extra]);
}

function centralHeader(entry, limit) {
  const wide = [entry.size >= limit, entry.packed >= limit, entry.offset >= limit];
  const fields = [entry.size, entry.packed, entry.offset].filter((_, i) => wide[i]);
  const name = Buffer.from(entry.name, 'utf8');
  const extra = fields.length ? zip64Extra(fields) : Buffer.alloc(0);
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE((3 << 8) | 45, 4);
  h.writeUInt16LE(fields.length ? 45 : 20, 6);
  h.writeUInt16LE(UTF8_FLAG, 8);
  h.writeUInt16LE(entry.method, 10);
  h.writeUInt16LE(DOS_TIME, 12);
  h.writeUInt16LE(DOS_DATE, 14);
  h.writeUInt32LE(entry.crc >>> 0, 16);
  h.writeUInt32LE(wide[1] ? LIMIT32 : entry.packed, 20);
  h.writeUInt32LE(wide[0] ? LIMIT32 : entry.size, 24);
  h.writeUInt16LE(name.length, 28);
  h.writeUInt16LE(extra.length, 30);
  h.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  h.writeUInt32LE(wide[2] ? LIMIT32 : entry.offset, 42);
  return Buffer.concat([h, name, extra]);
}

function endRecords({ count, cdSize, cdOffset }, limit) {
  const big = count >= LIMIT16 || cdSize >= limit || cdOffset >= limit;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(big ? LIMIT16 : count, 8);
  end.writeUInt16LE(big ? LIMIT16 : count, 10);
  end.writeUInt32LE(big ? LIMIT32 : cdSize, 12);
  end.writeUInt32LE(big ? LIMIT32 : cdOffset, 16);
  if (!big) return end;
  const rec = Buffer.alloc(56);
  rec.writeUInt32LE(0x06064b50, 0);
  rec.writeBigUInt64LE(44n, 4);
  rec.writeUInt16LE((3 << 8) | 45, 12);
  rec.writeUInt16LE(45, 14);
  rec.writeBigUInt64LE(BigInt(count), 24);
  rec.writeBigUInt64LE(BigInt(count), 32);
  rec.writeBigUInt64LE(BigInt(cdSize), 40);
  rec.writeBigUInt64LE(BigInt(cdOffset), 48);
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0);
  locator.writeBigUInt64LE(BigInt(cdOffset + cdSize), 8);
  locator.writeUInt32LE(1, 16);
  return Buffer.concat([rec, locator, end]);
}

function copyInto(fd, file) {
  const src = fs.openSync(file, 'r');
  const buf = Buffer.alloc(CHUNK);
  try {
    for (let n; (n = fs.readSync(src, buf, 0, CHUNK, null)) > 0;) fs.writeSync(fd, buf, 0, n);
  } finally { fs.closeSync(src); }
}

/**
 * Zip every file under `dir` into `out`, each under `prefix/` (the folder a person gets when they unzip). Returns the entry names.
 * `zip64Limit` is a test hook: a smaller limit writes the ZIP64 records for small files.
 */
export function zipFolder(dir, out, { prefix = '', zip64Limit = LIMIT32 } = {}) {
  const tmp = `${out}.tmp-${process.pid}`;
  const fd = fs.openSync(tmp, 'w');
  const entries = [];
  let offset = 0;
  const write = (buf) => { fs.writeSync(fd, buf); offset += buf.length; };
  try {
    for (const rel of listFiles(dir)) {
      const file = path.join(dir, rel);
      const deflated = DEFLATE_EXT.has(path.extname(rel).toLowerCase()) ? zlib.deflateRawSync(fs.readFileSync(file)) : null;
      const size = fs.statSync(file).size;
      const entry = { name: prefix ? `${prefix}/${rel}` : rel, size, packed: deflated ? deflated.length : size, method: deflated ? 8 : 0, crc: crcOf(file), offset };
      write(localHeader(entry, zip64Limit));
      if (deflated) write(deflated); else { copyInto(fd, file); offset += size; }
      entries.push(entry);
    }
    const cdOffset = offset;
    for (const entry of entries) write(centralHeader(entry, zip64Limit));
    write(endRecords({ count: entries.length, cdSize: offset - cdOffset, cdOffset }, zip64Limit));
  } catch (e) {
    fs.closeSync(fd);
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  fs.closeSync(fd);
  fs.renameSync(tmp, out);
  return entries.map((e) => e.name);
}
