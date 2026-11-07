// The sidecar every render writes beside its mp4: out/<name>[-draft].meta.json, the facts of that render keyed by the page digest.
// A render is current when its sidecar's pageDigest equals the page's now; a render with no sidecar (made before sidecars) falls back to mtimes, here and nowhere else.
import fs from 'node:fs';

export const metaPath = (mp4) => mp4.replace(/\.mp4$/, '.meta.json');

const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

export function readRenderMeta(mp4) {
  try { return JSON.parse(fs.readFileSync(metaPath(mp4), 'utf8')); } catch { return null; }
}

/** Writes the sidecar of `mp4` through a temp file and a rename, so a reader never sees half of it. Call it after every other output of the render exists. */
export function writeRenderMeta(mp4, meta) {
  const file = metaPath(mp4);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(meta, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

/** { digest, path, current } for the render at `mp4`, or null when the file is missing. `editedMs()` is the page's last edit, read only for a render with no sidecar. */
export function renderState(mp4, pageDigest, editedMs) {
  if (!fs.existsSync(mp4)) return null;
  const meta = readRenderMeta(mp4);
  return { digest: meta?.pageDigest ?? null, path: mp4, current: meta ? meta.pageDigest === pageDigest : mtime(mp4) >= editedMs() };
}
