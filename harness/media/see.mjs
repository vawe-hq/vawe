// harness/media/see.mjs · let an agent SEE a video or a page for the price of a few images.
//
//   node harness/media/see.mjs <video> [outDir] [--frames N]                    grids, beats, OCR words
//   node harness/media/see.mjs <video> --shot <from>-<to> [--fps N]             a dense strip of one window
//   node harness/media/see.mjs <mp4|page.html|ref-id> --moment <s> | --cuts [--span s --fps N]   one grid through a moment, or one per cut (`vawe frame`)
//   node harness/media/see.mjs <video> --compare <draft.mp4> [--from s --to s]  reference vs draft, same timestamps
//   node harness/media/see.mjs <html> --probe --at <s> --sel <css>              box, opacity, transform, animation progress
//   node harness/media/see.mjs <html> --look --times <s,...> [--ref <mp4>]      a still per time
//   node harness/media/see.mjs <html> --layout --times <s,...>                  clipped, overlapping, off-frame text
//   node harness/media/see.mjs <video|page.html> --phone | --strip <t> | --loop the critique views (see-views.mjs)
//   node harness/media/see.mjs <page.html> [outDir] --measure [--ref <mp4>]     numeric deltas in deltas.md
//   node harness/media/see.mjs <page.html> --dom [--ref <mp4>] [--final]        required-motion match from the DOM
//   node harness/media/see.mjs <ref.mp4> --word-events <film.mp4>               per-word entrance, highlight, exit
//   `vawe critique <page> [--ref <mp4>]` runs the critique views, --measure and (with a ref) --dom.
//
// One image costs at most ~1,568 tokens whatever it holds (a 3x3 grid at 1568 px long edge is ~174
// tokens a frame), so a few grids plus one index.md give an agent a whole video. ffmpeg and tesseract
// only; every page check loads the page through preview-server.mjs's one openPreview().
//
// The modules live in harness/media/see/ and this file re-exports them, so an importer keeps one path:
//   core      shared measures: energy, holds, probe, grid tiling
//   ocr       tesseract words, beats, frame choice and the default reading flow
//   compare   --shot, --compare, --sheet-check, --measure
//   strip     --moment, --cuts (strip-math.mjs holds the pure window, cut and settle maths)
//   dom       --dom and the required-motion and text-scale checks against a reference
//   words     per-word events from two videos
//   inspect   --probe, --look, --layout
//   cli       argument dispatch
import { main } from './see/cli.mjs';

export * from './see/core.mjs';
export * from './see/ocr.mjs';
export * from './see/compare.mjs';
export * from './see/dom.mjs';
export * from './see/words.mjs';
export * from './see/inspect.mjs';

if (import.meta.url === `file://${process.argv[1]}`) main();
