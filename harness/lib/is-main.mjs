// Whether a module is the script node was started with, on every OS. argv[1] is a path (C:\x\y.mjs on
// Windows) and import.meta.url the file URL of the resolved real path, so only a URL built from the real
// path compares: `file://${process.argv[1]}` never matches on Windows, or for a path with a space.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/** True when `metaUrl` (the caller's import.meta.url) is the entry script, so `node <script>` runs its CLI. */
export function isMain(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  let file = argv1;
  try { file = fs.realpathSync(argv1); } catch { /* not on disk: compare the path as given */ }
  return metaUrl === pathToFileURL(file).href;
}
