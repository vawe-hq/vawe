// The template export end to end on a 1 s fixture: layers render with alpha, the text leaves its layer for an editable one, and the
// zip holds every file the timelines name. Needs Chrome and ffmpeg.   node --test tests/media/template-export.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as acorn from 'acorn';
import { exportTemplate } from '../../harness/media/template-export.mjs';
import { referencedFiles } from '../../harness/lib/template-refs.mjs';

const PAGE = 'tests/fixtures/template/page.html';

/** [r, g, b, a] of pixel (x, y) in frame n of a clip. */
function pixel(file, n, x, y) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n}),crop=1:1:${x}:${y},format=rgba`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 20 });
  assert.equal(r.status, 0, String(r.stderr));
  return [...r.stdout];
}

const stream = (file) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,nb_read_frames', '-of', 'json', file], { encoding: 'utf8' }).stdout).streams[0];

test('a page exports to a zip of alpha clips, sound, an FCP 7 XML and an After Effects script that name only files it holds', { timeout: 300_000 }, async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-template-'));
  try {
    const r = await exportTemplate(PAGE, { fps: 10, blur: 1, out });
    const media = path.join(r.folder, 'media');
    const listed = fs.readdirSync(media).sort();
    assert.deepEqual(listed, ['01-world-first.mov', '02-world-second.png', '03-title-text-title.mov', 'cue-01-tap.wav', 'mix.wav']);
    const xml = fs.readFileSync(path.join(r.folder, 'premiere', 'template.xml'), 'utf8');
    const jsx = fs.readFileSync(path.join(r.folder, 'after-effects', 'build-template.jsx'), 'utf8');
    assert.deepEqual(referencedFiles(xml, jsx), listed);
    for (const file of listed) assert.ok(r.entries.includes(`template-template/media/${file}`), `${file} is in the zip`);
    for (const file of ['README.txt', 'export.json', 'premiere/template.xml', 'after-effects/build-template.jsx']) assert.ok(r.entries.includes(`template-template/${file}`), file);
    assert.doesNotThrow(() => acorn.parse(jsx, { ecmaVersion: 3 }));

    const first = stream(path.join(media, '01-world-first.mov'));
    assert.deepEqual([first.codec_name, first.width, first.height, Number(first.nb_read_frames)], ['prores', 1920, 1080, 6]);
    assert.match(first.pix_fmt, /^yuva444p/);
    assert.deepEqual([stream(path.join(media, '02-world-second.png')).pix_fmt], ['rgba64be'], 'a world that never changes is one 16-bit PNG');
    const red = pixel(path.join(media, '01-world-first.mov'), 2, 960, 900);
    assert.ok(red[0] > 90 && red[2] < 20 && red[3] === 255, `the first world is opaque red: ${red}`);

    const alphaMax = spawnSync('ffmpeg', ['-v', 'error', '-i', path.join(media, '03-title-text-title.mov'), '-vf', 'select=eq(n\\,8),alphaextract,format=gray,signalstats,metadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8' });
    assert.ok(Number(/YMAX=(\d+)/.exec(alphaMax.stdout)?.[1]) > 200, 'the reference clip holds the text');

    assert.ok(r.notes.includes('layer 03-title paints nothing once its editable text is lifted out, so it has no clip.'), r.notes.join('\n'));
    const exported = JSON.parse(fs.readFileSync(path.join(r.folder, 'export.json'), 'utf8'));
    assert.equal(exported.texts.length, 1);
    assert.deepEqual([exported.texts[0].id, exported.texts[0].text, exported.texts[0].size], ['title', 'Hello', 120]);
    assert.match(jsx, /"opacity":\[\[1,33.33\],\[3,100\]/, 'the editable text fades in over the first 0.3 s');
    assert.equal(spawnSync('unzip', ['-t', r.zip]).status, 0);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
