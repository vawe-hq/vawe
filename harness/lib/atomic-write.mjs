// harness/lib/atomic-write.mjs: a reader sees the old file or the new one, never half of it.
import fs from 'node:fs';

export function writeFileAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
