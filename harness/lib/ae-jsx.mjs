// The After Effects half of the template export: an ExtendScript file that builds the comp when run with
// File > Scripts > Run Script File. ExtendScript is ECMAScript 3 with no JSON object and no Array forEach or map, so the builder
// below is plain ES3 and the plan is written into it as an object literal. Pure.

// CSS mix-blend-mode to the BlendingMode enum of the After Effects scripting API.
const BLENDS = {
  screen: 'SCREEN', overlay: 'OVERLAY', multiply: 'MULTIPLY', darken: 'DARKEN', lighten: 'LIGHTEN', difference: 'DIFFERENCE',
  exclusion: 'EXCLUSION', 'hard-light': 'HARD_LIGHT', 'soft-light': 'SOFT_LIGHT', 'color-dodge': 'COLOR_DODGE', 'color-burn': 'COLOR_BURN',
  hue: 'HUE', saturation: 'SATURATION', color: 'COLOR', luminosity: 'LUMINOSITY', 'plus-lighter': 'ADD',
};
export const aeBlend = (blend) => BLENDS[blend] ?? null;

const JUSTIFY = { left: 'LEFT_JUSTIFY', center: 'CENTER_JUSTIFY', right: 'RIGHT_JUSTIFY' };

// JSON is an ES3 object literal except for two line terminators ES3 strings may not hold.
const LINE_SEPARATORS = new RegExp('[\\u2028\\u2029]', 'g');
export const es3Literal = (value) => JSON.stringify(value).replace(LINE_SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16)}`);

const keys = (list) => list.map((k) => [k.frame, k.value]);

/** The plan of one stack entry as the script reads it. Pure. */
function entryOf(entry) {
  if (entry.kind === 'clip') return { kind: 'clip', name: entry.name, file: entry.file, start: entry.start, end: entry.end, blend: aeBlend(entry.blend), reference: Boolean(entry.reference), sequence: Boolean(entry.sequence) };
  const { track, font } = entry;
  return {
    kind: 'text', name: `${track.label} (editable)`, id: track.id, text: track.style.text.replace(/\n/g, '\r'), font: font.name,
    size: track.style.size, tracking: +track.style.tracking.toFixed(1), leading: +track.style.leading.toFixed(2), justify: JUSTIFY[track.style.align],
    lines: track.style.text.split('\n').length, start: track.span[0], end: track.span[1],
    position: keys(track.position), scale: keys(track.scale).map(([f, s]) => [f, [s, s]]), opacity: keys(track.opacity), color: keys(track.color),
  };
}

const BUILDER = String.raw`
function vaweSeconds(frame) { return frame / PLAN.fps; }

function vaweMedia(name) {
  var here = new File($.fileName).parent;
  var file = new File(here.parent.fsName + "/media/" + name);
  if (!file.exists) throw new Error("missing " + file.fsName + ": keep the folders of the zip together");
  return file;
}

function vaweImport(name, folder, sequence) {
  var options = new ImportOptions(vaweMedia(name));
  if (sequence) options.sequence = true;
  var item = app.project.importFile(options);
  item.parentFolder = folder;
  return item;
}

function vawePlace(layer, start, end, name) {
  layer.startTime = vaweSeconds(start);
  layer.inPoint = vaweSeconds(start);
  layer.outPoint = vaweSeconds(end);
  layer.name = name;
}

function vaweAnimate(prop, list) {
  if (list.length === 1) { prop.setValue(list[0][1]); return; }
  var times = [], values = [];
  for (var i = 0; i < list.length; i++) { times.push(vaweSeconds(list[i][0])); values.push(list[i][1]); }
  prop.setValuesAtTimes(times, values);
  for (var k = 1; k <= prop.numKeys; k++) prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
}

function vaweClip(comp, folder, clip) {
  var item = vaweImport(clip.file, folder, clip.sequence);
  if (item.hasVideo && !item.mainSource.isStill) item.mainSource.conformFrameRate = PLAN.fps;
  if (item.hasVideo && item.mainSource.hasAlpha) item.mainSource.alphaMode = AlphaMode.STRAIGHT;
  var layer = comp.layers.add(item);
  vawePlace(layer, clip.start, clip.end, clip.name);
  if (clip.blend) layer.blendingMode = BlendingMode[clip.blend];
  if (clip.reference) { layer.enabled = false; layer.comment = "the original text, baked: a reference for the editable layer above"; }
  return layer;
}

function vaweFill(layer, list) {
  var fill = layer.property("ADBE Effect Parade").addProperty("ADBE Fill");
  var color = fill.property("ADBE Fill-0002");
  var keyed = [];
  for (var i = 0; i < list.length; i++) keyed.push([list[i][0], [list[i][1][0], list[i][1][1], list[i][1][2], 1]]);
  vaweAnimate(color, keyed);
}

function vaweText(comp, text) {
  var layer = comp.layers.addText(text.text);
  var source = layer.property("ADBE Text Properties").property("ADBE Text Document");
  var doc = source.value;
  try { doc.font = text.font; } catch (e) { PLAN.missing.push(text.font); }
  doc.fontSize = text.size;
  doc.applyFill = true;
  doc.fillColor = text.color[0][1];
  doc.applyStroke = false;
  doc.tracking = text.tracking;
  doc.justification = ParagraphJustification[text.justify];
  if (text.lines > 1) doc.leading = text.leading;
  source.setValue(doc);
  vawePlace(layer, text.start, text.end, text.name);
  layer.comment = "vawe input " + text.id + ": type your own words in the Source Text";
  var transform = layer.property("ADBE Transform Group");
  vaweAnimate(transform.property("ADBE Position"), text.position);
  vaweAnimate(transform.property("ADBE Scale"), text.scale);
  vaweAnimate(transform.property("ADBE Opacity"), text.opacity);
  if (text.color.length > 1) vaweFill(layer, text.color);
  return layer;
}

function vaweMarkers(comp) {
  for (var i = 0; i < PLAN.markers.length; i++) {
    var m = PLAN.markers[i];
    var value = new MarkerValue(m.name);
    value.comment = m.comment;
    value.duration = vaweSeconds(m.end - m.start);
    comp.markerProperty.setValueAtTime(vaweSeconds(m.start), value);
  }
}

function vaweBuild() {
  var folder = app.project.items.addFolder(PLAN.name + " media");
  var comp = app.project.items.addComp(PLAN.name, PLAN.width, PLAN.height, 1, vaweSeconds(PLAN.frames), PLAN.fps);
  for (var a = 0; a < PLAN.audio.length; a++) {
    var sound = comp.layers.add(vaweImport(PLAN.audio[a].file, folder));
    vawePlace(sound, PLAN.audio[a].start, PLAN.audio[a].end, PLAN.audio[a].name);
    if (!PLAN.audio[a].enabled) sound.audioEnabled = false;
  }
  for (var i = 0; i < PLAN.stack.length; i++) {
    if (PLAN.stack[i].kind === "clip") vaweClip(comp, folder, PLAN.stack[i]);
    else vaweText(comp, PLAN.stack[i]);
  }
  vaweMarkers(comp);
  comp.openInViewer();
  return comp;
}

app.beginUndoGroup("vawe: build " + PLAN.name);
try {
  vaweBuild();
  if (PLAN.missing.length) alert("Built " + PLAN.name + ". Install these fonts from the fonts folder, then reopen the project: " + PLAN.missing.join(", "));
} catch (err) {
  alert("vawe: the build stopped: " + err.toString() + (err.line ? " (line " + err.line + ")" : ""));
} finally {
  app.endUndoGroup();
}
`;

/**
 * The script. plan: { name, width, height, fps, frames, stack: [clip | text] bottom first, audio: [{ name, file, start, end, enabled }],
 * markers: [{ name, comment, start, end }] }. A clip: { kind: 'clip', name, file, start, end, blend, reference, sequence }; a text:
 * { kind: 'text', track (template-plan.mjs textTrack), font: { name } }. Every time is a whole frame.
 */
export function aeJsx(plan) {
  const data = { name: plan.name, width: plan.width, height: plan.height, fps: plan.fps, frames: plan.frames, stack: plan.stack.map(entryOf), audio: plan.audio, markers: plan.markers, missing: [] };
  const head = `// Built by vawe (bin/vawe-dev template) from ${plan.name}. In After Effects: File > Scripts > Run Script File, then pick this file.\n// It needs the media folder next to this folder, as the zip has it.\n`;
  return `${head}(function () {\nvar PLAN = ${es3Literal(data)};\n${BUILDER}\n}());\n`;
}
