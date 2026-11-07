#!/usr/bin/env node
// `vawe footage add <film> <clip|folder>... [--full]` and `vawe footage log <film>`: see harness/media/footage.mjs.
import path from 'node:path';
import { addFootage, filmDirOf, logFootage } from './footage.mjs';

const [action, film, ...rest] = process.argv.slice(2);
const full = rest.includes('--full');
const inputs = rest.filter((a) => a !== '--full');
const die = (m) => { console.error(`error: ${m}`); process.exit(2); };

try {
  const dir = filmDirOf(film);
  if (action === 'add') {
    if (!inputs.length) die('give a clip or a folder: vawe footage add <film> <clip|folder>...');
    for (const c of addFootage(dir, inputs, { full })) {
      console.log(`${c.skipped ? 'kept ' : 'wrote'} ${path.relative(process.cwd(), c.file)}: ${c.seconds} s, ${c.fps} fps, ${c.width}x${c.height}, audio ${c.hasAudio ? 'yes' : 'no'}`);
    }
  } else if (action === 'log') {
    console.log(`wrote ${path.relative(process.cwd(), logFootage(dir).path)}`);
  } else die(`unknown action "${action}": add or log`);
} catch (e) { die(e.message); }
