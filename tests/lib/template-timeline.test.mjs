// The timelines of the template export: the FCP 7 XML Premiere imports and the ExtendScript After Effects runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as acorn from 'acorn';
import { premiereXml, pathUrl, compositeMode } from '../../harness/lib/premiere-xml.mjs';
import { aeJsx, es3Literal } from '../../harness/lib/ae-jsx.mjs';
import { referencedFiles } from '../../harness/lib/template-refs.mjs';
import { soundClips, worldMarkers, toFrame } from '../../harness/lib/template-plan.mjs';

// A strict reader for the XML the builder writes: elements, text and attributes only; it throws on a tag that does not close.
function parseXml(xml) {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '').replace(/^<!DOCTYPE[^>]*>\s*/, '');
  const root = { name: '#root', children: [], text: '' };
  const stack = [root];
  for (const [, close, name, attrs, self, text] of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    const top = stack.at(-1);
    if (text !== undefined) { top.text += text; continue; }
    if (close) {
      assert.equal(top.name, name, `</${name}> closes <${top.name}>`);
      stack.pop();
      continue;
    }
    const node = { name, attrs: Object.fromEntries([...attrs.matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v])), children: [], text: '' };
    top.children.push(node);
    if (!self) stack.push(node);
  }
  assert.equal(stack.length, 1, `unclosed <${stack.at(-1).name}>`);
  assert.equal(root.children.length, 1, 'one root element');
  return root.children[0];
}

const kids = (node, name) => node.children.filter((c) => c.name === name);
const kid = (node, name) => { const [k] = kids(node, name); assert.ok(k, `<${node.name}> has no <${name}>`); return k; };
const num = (node, name) => Number(kid(node, name).text);
// Values built inside the script's own context are arrays of another realm, which deepEqual tells apart.
const plain = (v) => JSON.parse(JSON.stringify(v));

// A 5 s film: a ground from 0.7 s to 2 s, a glow that screens over it, a text clip, a cue at 0.3 s and a world marker.
function film(fps) {
  const f = (s) => toFrame(s, fps);
  return {
    name: 'demo film', width: 1920, height: 1080, fps, frames: f(5), mediaRoot: '/vawe-template/media',
    video: [
      { name: '01-world-cold', file: '01-world-cold.mov', start: 0, end: f(0.7) },
      { name: '02-world-warm', file: '02-world warm.mov', start: f(0.7), end: f(2) },
      { name: '03-glow', file: '03-glow.mov', start: 0, end: f(5), blend: 'screen' },
      { name: '04-grain', file: '04-grain.mov', start: 0, end: f(5), blend: 'overlay' },
    ],
    audio: soundClips({ mix: '/x/mix.wav', cues: [{ file: '/x/cue-01-tap.wav', at: 0.3, seconds: 0.25 }, { file: '/x/cue-02-thump.wav', at: 4.9, seconds: 1 }] }, f(5), fps),
    markers: worldMarkers([{ id: 'cold', start: 0, end: 0.7 }, { id: 'never', start: null, end: null }, { id: 'warm', start: 0.7, end: 2 }], fps),
  };
}

for (const fps of [30, 60]) {
  test(`premiere XML at ${fps} fps: one xmeml sequence at the timebase, whole frames, every clip on its own track in order`, () => {
    const seq = parseXml(premiereXml(film(fps)));
    assert.equal(seq.name, 'xmeml');
    assert.equal(seq.attrs.version, '4');
    const sequence = kid(seq, 'sequence');
    assert.equal(num(kid(sequence, 'rate'), 'timebase'), fps);
    assert.equal(kid(kid(sequence, 'rate'), 'ntsc').text, 'FALSE');
    assert.equal(num(sequence, 'duration'), 5 * fps);
    const video = kid(kid(sequence, 'media'), 'video');
    const samples = kid(kid(video, 'format'), 'samplecharacteristics');
    assert.deepEqual([num(samples, 'width'), num(samples, 'height')], [1920, 1080]);
    const tracks = kids(video, 'track').map((t) => kid(t, 'clipitem'));
    assert.deepEqual(tracks.map((c) => kid(c, 'name').text), ['01-world-cold', '02-world-warm', '03-glow', '04-grain'], 'V1 is the first, lowest clip');
    const warm = tracks[1];
    assert.deepEqual(['start', 'end', 'in', 'out', 'duration'].map((k) => num(warm, k)), [0.7 * fps, 2 * fps, 0, 1.3 * fps, 1.3 * fps]);
    assert.equal(kid(warm, 'alphatype').text, 'straight');
    assert.equal(kid(kid(warm, 'file'), 'pathurl').text, 'file://localhost/vawe-template/media/02-world%20warm.mov');
    assert.equal(kid(tracks[2], 'compositemode').text, 'screen');
    assert.equal(kids(tracks[3], 'compositemode').length, 0, 'overlay has no FCP 7 composite mode');
    const audio = kids(kid(kid(sequence, 'media'), 'audio'), 'track').map((t) => kid(t, 'clipitem'));
    assert.deepEqual(audio.map((c) => kid(c, 'name').text), ['mix (the whole sound track)', 'cue-01-tap', 'cue-02-thump']);
    assert.equal(kid(audio[0], 'enabled').text, 'FALSE', 'the mix is a reference, turned off');
    assert.deepEqual([num(audio[1], 'start'), num(audio[1], 'end')], [toFrame(0.3, fps), toFrame(0.3, fps) + toFrame(0.25, fps)]);
    assert.equal(num(audio[2], 'end'), 5 * fps, 'a cue that runs past the end is cut at the end');
    assert.equal(kid(kid(audio[1], 'sourcetrack'), 'mediatype').text, 'audio');
    const markers = kids(sequence, 'marker');
    assert.deepEqual(markers.map((m) => [kid(m, 'name').text, num(m, 'in'), num(m, 'out')]), [['cold', 0, 0.7 * fps], ['warm', 0.7 * fps, 2 * fps]]);
  });
}

test('premiere XML refuses a time that is not a whole frame and a rate that is not a whole number', () => {
  const seq = film(30);
  assert.throws(() => premiereXml({ ...seq, video: [{ ...seq.video[0], end: 20.5 }] }), /whole frames/);
  assert.throws(() => premiereXml({ ...seq, video: [{ ...seq.video[0], start: 5, end: 5 }] }), /end > start/);
  assert.throws(() => premiereXml({ ...seq, fps: 29.97 }), /whole number/);
});

test('XML text is escaped, and a pathurl encodes every segment', () => {
  const xml = premiereXml({ ...film(30), name: 'a & b <c>' });
  assert.match(xml, /<name>a &amp; b &lt;c&gt;<\/name>/);
  parseXml(xml);
  assert.equal(pathUrl('/a b/', 'c#d.mov'), 'file://localhost/a%20b/c%23d.mov');
  assert.equal(compositeMode('hard-light'), 'hardlight');
  assert.equal(compositeMode('normal'), null);
});

function aePlan(fps) {
  const seq = film(fps);
  const track = {
    id: 'name', label: 'Brand name', selector: '.name', span: [toFrame(1, fps), toFrame(5, fps)],
    style: { text: 'Onsen\nline two', family: 'Unbounded', size: 120, tracking: 0, leading: 132, align: 'left' },
    position: [{ frame: toFrame(1, fps), value: [100, 500] }, { frame: toFrame(2, fps), value: [140, 500] }],
    scale: [{ frame: toFrame(1, fps), value: 100 }], opacity: [{ frame: toFrame(1, fps), value: 0 }, { frame: toFrame(1.5, fps), value: 100 }],
    color: [{ frame: toFrame(1, fps), value: [1, 0.9, 0.8] }, { frame: toFrame(3, fps), value: [0.1, 0, 0] }],
  };
  return {
    ...seq,
    stack: [
      ...seq.video.map((c) => ({ kind: 'clip', ...c })),
      { kind: 'clip', name: '05-text-name', file: '05-text-name.mov', start: track.span[0], end: track.span[1], blend: 'normal', reference: true },
      { kind: 'text', track, font: { name: 'Unbounded-Regular' } },
    ],
  };
}

test('the After Effects script parses as ECMAScript 3', () => {
  const jsx = aeJsx(aePlan(30));
  assert.doesNotThrow(() => acorn.parse(jsx, { ecmaVersion: 3, allowReserved: false }));
  assert.doesNotMatch(jsx, /=>|\blet\b|\bconst\b|`|\bJSON\./, 'no ES5+ syntax and no JSON object');
  assert.throws(() => acorn.parse('var a = [1, 2,]; var f = () => 1;', { ecmaVersion: 3 }), 'the parser does reject ES5+ syntax');
});

test('a line separator in the copy stays a legal ES3 string', () => {
  const literal = es3Literal({ text: `a${String.fromCharCode(0x2028)}b` });
  assert.equal(literal, '{"text":"a\\u2028b"}');
  assert.doesNotThrow(() => acorn.parse(`var x = ${literal};`, { ecmaVersion: 3 }));
});

// A stand-in for the parts of the After Effects scripting API the script calls, recording what it builds.
function fakeAfterEffects() {
  const made = { comps: [], imports: [], alerts: [], undo: [] };
  const prop = () => ({ keys: [], value: null, numKeys: 0, setValue(v) { this.value = v; }, setValuesAtTimes(t, v) { this.keys = t.map((x, i) => [x, v[i]]); this.numKeys = t.length; }, setInterpolationTypeAtKey() {} });
  const layer = (source) => {
    const props = {};
    const group = (name) => (props[name] ||= { props: {}, property(n) { return (this.props[n] ||= prop()); }, addProperty(n) { return (this.props[n] ||= group(n)); } });
    return { source, props, enabled: true, audioEnabled: true, property: (name) => group(name) };
  };
  const comp = (name, width, height, pa, duration, fps) => {
    const c = { name, width, height, duration, fps, layers: [], markers: [], openInViewer() {} };
    c.layers.add = (item) => { const l = layer(item); c.layers.unshift(l); return l; };
    c.layers.addText = (text) => {
      const l = layer({ text });
      const doc = { text };
      l.property('ADBE Text Properties').property('ADBE Text Document').value = doc;
      c.layers.unshift(l);
      return l;
    };
    c.markerProperty = { setValueAtTime: (t, v) => c.markers.push([t, v]) };
    made.comps.push(c);
    return c;
  };
  const sandbox = {
    $: { fileName: '/zip/demo/after-effects/build-demo.jsx' },
    File: function File(p) { this.fsName = p; this.exists = true; this.parent = { fsName: p.split('/').slice(0, -1).join('/'), parent: { fsName: p.split('/').slice(0, -2).join('/') } }; },
    ImportOptions: function ImportOptions(f) { this.file = f; },
    MarkerValue: function MarkerValue(n) { this.name = n; },
    KeyframeInterpolationType: { LINEAR: 1 }, AlphaMode: { STRAIGHT: 'straight' }, ParagraphJustification: { LEFT_JUSTIFY: 'left' },
    BlendingMode: { SCREEN: 'screen', OVERLAY: 'overlay' },
    alert: (m) => made.alerts.push(m),
    app: {
      beginUndoGroup: (n) => made.undo.push(n), endUndoGroup: () => made.undo.push('end'),
      project: { importFile: (o) => { made.imports.push(o.file.fsName); return { file: o.file.fsName, hasVideo: o.file.fsName.endsWith('.mov'), mainSource: { hasAlpha: true } }; }, items: { addFolder: () => ({}), addComp: comp } },
    },
  };
  return { made, sandbox };
}

for (const fps of [30, 60]) {
  test(`the After Effects script at ${fps} fps builds the comp, the layers in order, the live text and the markers`, () => {
    const { made, sandbox } = fakeAfterEffects();
    vm.runInNewContext(aeJsx(aePlan(fps)), sandbox);
    assert.deepEqual(made.alerts, [], made.alerts.join('\n'));
    const [comp] = made.comps;
    assert.deepEqual([comp.name, comp.width, comp.height, comp.duration, comp.fps], ['demo film', 1920, 1080, 5, fps]);
    assert.ok(made.imports.every((f) => f.startsWith('/zip/demo/media/')), 'media resolves next to the script folder');
    const bottomUp = [...comp.layers].reverse();
    assert.deepEqual(bottomUp.map((l) => l.name), ['mix (the whole sound track)', 'cue-01-tap', 'cue-02-thump', '01-world-cold', '02-world-warm', '03-glow', '04-grain', '05-text-name', 'Brand name (editable)']);
    const warm = bottomUp[4];
    assert.deepEqual([warm.startTime, warm.inPoint, warm.outPoint], [0.7, 0.7, 2].map((s) => toFrame(s, fps) / fps));
    assert.equal(warm.source.mainSource.alphaMode, 'straight');
    assert.equal(warm.source.mainSource.conformFrameRate, fps);
    assert.equal(bottomUp[5].blendingMode, 'screen');
    assert.equal(bottomUp[0].audioEnabled, false, 'the mix is turned off');
    assert.equal(bottomUp[7].enabled, false, 'the baked text is a reference, turned off');
    const text = bottomUp[8];
    const doc = text.property('ADBE Text Properties').property('ADBE Text Document').value;
    assert.deepEqual([doc.text, doc.font, doc.fontSize, doc.leading, doc.justification], ['Onsen\rline two', 'Unbounded-Regular', 120, 132, 'left']);
    const position = text.property('ADBE Transform Group').property('ADBE Position');
    assert.deepEqual(plain(position.keys), [[1, [100, 500]], [2, [140, 500]]]);
    assert.equal(text.property('ADBE Transform Group').property('ADBE Scale').value.join(), '100,100');
    const fill = text.property('ADBE Effect Parade').addProperty('ADBE Fill').property('ADBE Fill-0002');
    assert.deepEqual(plain(fill.keys.map((k) => k[0])), [1, 3]);
    assert.deepEqual(plain(fill.keys[1][1]), [0.1, 0, 0, 1]);
    assert.deepEqual(comp.markers.map(([t, m]) => [t, m.name, m.duration]), [[0, 'cold', toFrame(0.7, fps) / fps], [toFrame(0.7, fps) / fps, 'warm', (toFrame(2, fps) - toFrame(0.7, fps)) / fps]]);
    assert.deepEqual(made.undo, ['vawe: build demo film', 'end']);
  });
}

test('every file the two timelines name is read back from them', () => {
  const plan = aePlan(30);
  const files = referencedFiles(premiereXml(film(30)), aeJsx(plan));
  assert.deepEqual(files, ['01-world-cold.mov', '02-world warm.mov', '03-glow.mov', '04-grain.mov', '05-text-name.mov', 'cue-01-tap.wav', 'cue-02-thump.wav', 'mix.wav']);
});
