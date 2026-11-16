import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const CHECKOUT = fs.existsSync(path.join(ENGINE, '.git'));

// VAWE_WORK names the workspace outright (a test or a second film root). An installed package (npx vawe) keeps its engine in ENGINE and the person's films/ and out/ in the folder they run it from.
export const WORK = process.env.VAWE_WORK ? path.resolve(process.env.VAWE_WORK) : CHECKOUT ? ENGINE : process.cwd();
