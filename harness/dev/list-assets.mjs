// node harness/dev/list-assets.mjs fonts|sounds: the one-line-each listings behind the `vawe fonts` alias and `vawe sound`.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fontLines, parseSystemFonts, soundLines, systemFontLines } from '../lib/asset-lists.mjs';
import { CUES, DEFAULT_GAIN_DB, renderCue, wavDuration } from '../../core/audio/kit.mjs';

const [what, flag] = process.argv.slice(2);
if (what === 'fonts' && flag === '--system') {
  const r = spawnSync('fc-list', ['--format', '%{family[0]}|%{style[0]}\\n'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.error('vawe fonts --system needs fc-list (fontconfig; on macOS: brew install fontconfig)');
    process.exit(1);
  }
  console.log(systemFontLines(parseSystemFonts(r.stdout)).join('\n'));
} else if (what === 'fonts') {
  const lock = JSON.parse(fs.readFileSync(new URL('../media/fonts.lock.json', import.meta.url), 'utf8'));
  console.log(fontLines(lock.faces).join('\n'));
} else if (what === 'sounds') {
  console.log(soundLines(CUES, DEFAULT_GAIN_DB, (spec) => wavDuration(renderCue(spec))).join('\n'));
} else {
  console.error('usage: list-assets.mjs fonts|sounds');
  process.exit(2);
}
