// What `--out` means in every `vawe frame` mode: a path ending in .png is a file (for a set of grids, the name they start with),
// any other path is a folder that holds the files under their default names.
import path from 'node:path';

/** { dir, file } of `out`: `file` is the absolute .png path, or null when `out` is a folder. Null when `out` is not given. Pure. */
export function outTarget(out) {
  if (out === undefined) return null;
  const abs = path.resolve(out);
  return /\.png$/i.test(abs) ? { dir: path.dirname(abs), file: abs } : { dir: abs, file: null };
}

/** The problem with `out` when it names a picture that is not a PNG (the bytes are PNG, so the name would lie), or null. Pure. */
export function outProblem(out) {
  if (out === undefined || !/\.(jpe?g|webp|gif|bmp|tiff?)$/i.test(out)) return null;
  return `a frame is a PNG: --out ${path.basename(out)} must end in .png, or name a folder`;
}

/** The absolute path of the one file a call writes: `out` as a file, `out` as the folder of `fallback`'s name, or `fallback` when no `out`. Pure. */
export function outFile(out, fallback) {
  const target = outTarget(out);
  if (!target) return path.resolve(fallback);
  return target.file ?? path.join(target.dir, path.basename(fallback));
}

/** The file for the `label` of one of `count` files that share `file`: `file` itself for one, `<name>-<label>.png` for several. Pure. */
export function numbered(file, label, count) {
  return count === 1 ? file : file.replace(/\.png$/i, `-${label}.png`);
}
