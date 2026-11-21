// README.txt of a template export: plain words for a motion designer who opens the zip. Pure.

const secs = (frame, fps) => `${(frame / fps).toFixed(2)} s`;

function textLines(texts, fps) {
  if (!texts.length) return ['No text in this template is marked editable: every word is part of the picture.'];
  return texts.flatMap(({ track, font }) => [
    `- "${track.label}": ${JSON.stringify(track.style.text)}, ${font.name} at ${track.style.size.toFixed(0)} px, from ${secs(track.span[0], fps)} to ${secs(track.span[1], fps)}.`,
    ...(font.guessed ? [`  The font name is a guess from the family and weight. If After Effects shows a missing font, pick ${track.style.family} by hand.`] : []),
    ...track.effects.map((e) => `  From ${e.from.toFixed(2)} s to ${e.to.toFixed(2)} s the film draws this text through a mask or a clip shape, which can hide part of it. The editable layer shows the whole text there; add your own mask to match the reference clip.`),
  ]);
}

function layerLines(layers, fps) {
  return layers.map((l) => `- ${l.sequence ? `${l.file.split('/')[0]}/ (PNG sequence)` : l.file}:${secs(l.start, fps)} to ${secs(l.end, fps)}${l.blend !== 'normal' ? `, blend mode ${l.blend}` : ''}${l.blendVaries ? ' (the film changes this blend mode over time; the clip uses normal)' : ''}${l.reference ? ' (the text only, as the film draws it)' : ''}`);
}

/**
 * The README. info: { name, width, height, fps, frames, layers: [{ file, start, end, blend, blendVaries, reference }], texts: [{ track, font }],
 * audio: { mix, cues: [{ file }] }, skipped: [labels], notes: [lines] }.
 */
export function templateReadme(info) {
  const { name, width, height, fps, frames } = info;
  const sequences = info.layers.filter((l) => l.sequence);
  return [
    `${name}: a motion template made with vawe (https://vawe.dev)`,
    '',
    `Size ${width} x ${height}, ${fps} frames a second, ${(frames / fps).toFixed(2)} s.`,
    sequences.length
      ? 'Every picture layer has a transparent background, so the layers stack like the layers of the film. A layer that moves is a folder of numbered PNG pictures (lossless, with alpha); a photographic layer is an Apple ProRes 4444 clip (.mov).'
      : 'Every picture clip is Apple ProRes 4444 with a transparent background, so the clips stack like the layers of the film.',
    '',
    'WHAT IS INSIDE',
    `- media/: the picture layers (${sequences.length ? 'folders of .png, .png and .mov' : '.mov and .png'}) and the sound (.wav).`,
    `- premiere/${name}.xml: the timeline for Adobe Premiere Pro.`,
    `- after-effects/build-${name}.jsx: a script that builds the composition in Adobe After Effects.`,
    '- fonts/: the fonts of the editable text. Install them before you open the template.',
    '- export.json: the same facts as this file, for a program to read.',
    '',
    'OPEN IT IN AFTER EFFECTS',
    '1. Unzip the file. Keep the folders together.',
    '2. Install the fonts in fonts/.',
    '3. In After Effects, choose File > Scripts > Run Script File, and pick after-effects/build-' + `${name}.jsx.`,
    `4. The script makes the composition "${name}" and opens it. Choose Edit > Undo to remove it again.`,
    '',
    'OPEN IT IN PREMIERE PRO',
    '1. Unzip the file. Keep the folders together.',
    `2. In Premiere Pro, choose File > Import, and pick premiere/${name}.xml.`,
    '3. Premiere asks where the media is. Click Locate, open the media folder, pick the file it names, and keep "Relink others automatically" on.',
    `4. Open the sequence "${name}" from the new bin.`,
    '',
    'WHAT YOU CAN EDIT',
    'In After Effects, each text below is a live text layer. Select it, then type over it. Its position, size, fade and colour follow the film.',
    'The film\'s own copy of that text sits under it as a reference clip, turned off. Turn it on to compare.',
    'In Premiere Pro, the text is part of its own clip (the "text" clips), on the track above its layer. Replace that clip to change the words.',
    ...textLines(info.texts, fps),
    '',
    'Every clip is on its own track (Premiere) or layer (After Effects): move, trim, recolour or swap any of them.',
    ...(sequences.length ? [
      'PNG sequences: After Effects imports each folder as one footage item. If Premiere shows a sequence layer as one still picture, delete it from the bin, choose File > Import, open the folder, pick the first .png and tick "Image Sequence", then put it back on the same track.',
    ] : []),
    'The markers on the timeline name each scene of the film.',
    '',
    'THE LAYERS, BOTTOM FIRST',
    ...layerLines(info.layers, fps),
    ...(info.skipped.length ? [`Parts of the page that never show are left out: ${info.skipped.join(', ')}.`] : []),
    '',
    'SOUND',
    info.audio.mix
      ? `media/mix.wav is the whole sound track of the film, on a track (Premiere: A1) or layer of its own, turned off. Each sound effect is also a file of its own (${info.audio.cues.length} files, media/cue-*.wav), placed at its time and turned on.`
      : 'The film has no sound.',
    '',
    ...(info.notes?.length ? ['NOTES', ...info.notes.map((n) => `- ${n}`), ''] : []),
    'WHAT IS NOT KEPT',
    '- A live text layer moves as one block: a word that moves, wipes or changes colour on its own stays as it is in the reference clip.',
    '- Motion blur, glows and grain are part of the clips, not effects you can change.',
    '- Premiere Pro: if a layer with a blend mode above plays as normal, set it in Effect Controls > Opacity > Blend Mode.',
  ].join('\n');
}
