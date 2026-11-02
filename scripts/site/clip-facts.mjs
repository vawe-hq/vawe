import fs from 'node:fs';
import { clipHash } from '../../harness/lib/clip-hash.mjs';

// Seconds, from the mvhd box of an mp4 (the move clips are plain H.264, so no ffprobe in prebuild).
export function mp4Seconds(file) {
  const b = fs.readFileSync(file);
  const at = b.indexOf('mvhd');
  if (at === -1) return null;
  const v1 = b[at + 4] === 1;
  const scale = b.readUInt32BE(at + (v1 ? 24 : 16));
  const units = v1 ? Number(b.readBigUInt64BE(at + 28)) : b.readUInt32BE(at + 20);
  return scale ? Math.round((units / scale) * 100) / 100 : null;
}

// The master clips (prompts/moves/<stem>.mp4) are not tracked. `lockClip` is the hash of the clip the last
// render wrote (clips.lock.json). A master is used only when it is that clip; otherwise, and when there is
// none, the hash, date and length recorded in site/lib/moves.json stand.
export function clipFacts(file, recorded, lockClip, stem, warn = console.warn) {
  let facts = recorded;
  if (fs.existsSync(file)) {
    const hash = clipHash(file);
    if (lockClip && hash !== lockClip) {
      warn(`~ prompts/moves/${stem}.mp4 is older than the lock: bin/vawe-dev moves --only ${stem}`);
    } else if (hash !== recorded.hash) {
      facts = { hash, date: new Date(fs.statSync(file).mtimeMs).toISOString().slice(0, 10), duration: mp4Seconds(file) };
    }
  }
  if (lockClip && lockClip !== facts.hash) {
    warn(`~ ${stem}: render newer than the site copy: bin/vawe-dev moves --only ${stem}, then node scripts/site/moves.mjs --clips`);
  }
  return facts;
}
