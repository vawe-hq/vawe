import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const CHECKOUT = fs.existsSync(path.join(ENGINE, '.git'));

// An installed package (npx vawe) keeps its engine in ENGINE and the person's films/ and out/ in the folder they run it from.
export const WORK = CHECKOUT ? ENGINE : process.cwd();
