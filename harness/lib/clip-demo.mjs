import path from 'node:path';

const DEMO_DIR = `${path.sep}prompts${path.sep}moves${path.sep}demo${path.sep}`;

/** The rules about a whole film's shape: a one-beat clip has no worlds to turn, no ground to live and no speed bands to vary. */
export const CLIP_SKIP_RULES = new Set(['world-turns', 'living-ground', 'speed-bands']);

/** True for a page under prompts/moves/demo/: a clip rendered by `bin/vawe-dev moves`, not a film with a brief. */
export const isClipDemo = (pagePath) => path.resolve(pagePath).includes(DEMO_DIR);
