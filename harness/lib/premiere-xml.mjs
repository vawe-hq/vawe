// The Premiere Pro half of the template export: an FCP 7 XML (xmeml) sequence, which Premiere opens with File > Import.
// Element names and values follow Apple's Final Cut Pro XML reference; every time is a whole frame at the sequence timebase. Pure.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const tag = (name, body) => `<${name}>${body}</${name}>`;
const text = (name, value) => tag(name, esc(value));

// Composite modes FCP 7 XML can name; a CSS blend mode outside this list (overlay among them) stays normal in Premiere.
const COMPOSITE = { screen: 'screen', multiply: 'multiply', darken: 'darken', lighten: 'lighten', difference: 'difference', 'hard-light': 'hardlight', 'soft-light': 'softlight', 'plus-lighter': 'add' };
export const compositeMode = (blend) => COMPOSITE[blend] ?? null;

/** The pathurl of `file` under the absolute folder `root`: file://localhost and each segment percent-encoded. Pure. */
export function pathUrl(root, file) {
  const segments = `${root.replace(/\/+$/, '')}/${file}`.split('/').filter(Boolean).map(encodeURIComponent);
  return `file://localhost/${segments.join('/')}`;
}

const rate = (fps) => tag('rate', `${text('timebase', fps)}${text('ntsc', 'FALSE')}`);

const videoSamples = ({ fps, width, height }) => tag('samplecharacteristics',
  `${rate(fps)}${text('width', width)}${text('height', height)}${text('anamorphic', 'FALSE')}${text('pixelaspectratio', 'square')}${text('fielddominance', 'none')}`);

const audioSamples = () => tag('samplecharacteristics', `${text('depth', 24)}${text('samplerate', 48000)}`);

function fileElement(clip, id, seq) {
  const media = clip.kind === 'audio'
    ? tag('audio', `${audioSamples()}${text('channelcount', 2)}`)
    : tag('video', videoSamples(seq));
  return `<file id="${id}">${text('name', clip.file.split('/').at(-1))}${text('pathurl', pathUrl(seq.mediaRoot, clip.file))}${rate(seq.fps)}${text('duration', clip.end - clip.start)}${tag('media', media)}</file>`;
}

function clipItem(clip, n, seq) {
  const length = clip.end - clip.start;
  const video = clip.kind !== 'audio';
  const parts = [
    text('name', clip.name), text('enabled', clip.enabled === false ? 'FALSE' : 'TRUE'), text('duration', length), rate(seq.fps),
    text('start', clip.start), text('end', clip.end), text('in', 0), text('out', length),
    ...(video ? [text('alphatype', 'straight'), text('pixelaspectratio', 'square'), text('anamorphic', 'FALSE')] : []),
    fileElement(clip, `file-${n}`, seq),
    ...(video && compositeMode(clip.blend) ? [text('compositemode', compositeMode(clip.blend))] : []),
    ...(video ? [] : [tag('sourcetrack', `${text('mediatype', 'audio')}${text('trackindex', 1)}`)]),
  ];
  return `<clipitem id="clipitem-${n}">${parts.join('')}</clipitem>`;
}

const track = (clip, n, seq) => tag('track', `${clipItem(clip, n, seq)}${text('enabled', 'TRUE')}${text('locked', 'FALSE')}`);

function marker(m) {
  return tag('marker', `${text('comment', m.comment ?? '')}${text('name', m.name)}${text('in', m.start)}${text('out', m.end ?? -1)}`);
}

/**
 * The sequence as FCP 7 XML. seq: { name, width, height, fps (whole frames a second), frames, mediaRoot (the absolute folder the
 * pathurls point at), video: [{ name, file, start, end, enabled?, blend? }] bottom first, audio: [{ name, file, start, end, enabled? }],
 * markers: [{ name, comment, start, end }] }. Each clip gets a track of its own: the first video track is V1, the lowest.
 */
export function premiereXml(seq) {
  if (!Number.isInteger(seq.fps) || seq.fps <= 0) throw new Error(`premiereXml: fps must be a whole number of frames a second, got ${seq.fps}`);
  for (const clip of [...seq.video, ...seq.audio]) {
    if (!(Number.isInteger(clip.start) && Number.isInteger(clip.end) && clip.end > clip.start)) throw new Error(`premiereXml: ${clip.name} needs whole frames with end > start, got ${clip.start}-${clip.end}`);
  }
  const clips = [...seq.video.map((c) => ({ ...c, kind: 'video' })), ...seq.audio.map((c) => ({ ...c, kind: 'audio' }))];
  const tracks = clips.map((c, i) => track(c, i + 1, seq));
  const video = tag('video', `${tag('format', videoSamples(seq))}${tracks.slice(0, seq.video.length).join('')}`);
  const audio = tag('audio', `${text('numOutputChannels', 2)}${tag('format', audioSamples())}${tracks.slice(seq.video.length).join('')}`);
  const timecode = tag('timecode', `${rate(seq.fps)}${text('string', '00:00:00:00')}${text('frame', 0)}${text('displayformat', 'NDF')}`);
  const body = `${text('name', seq.name)}${text('duration', seq.frames)}${rate(seq.fps)}${timecode}${tag('media', `${video}${audio}`)}${seq.markers.map(marker).join('')}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4"><sequence id="sequence-1">${body}</sequence></xmeml>\n`;
}
