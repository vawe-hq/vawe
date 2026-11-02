// verify-render.mjs: prove a generated typeface JSON actually EXTRUDES, in the right typeface.
//
//   node generators/fonts/verify-render.mjs Anybody
//
// Writes /tmp/glyphs-<Name>.png, to be LOOKED AT. Inspecting the JSON proves nothing: a file full of
// plausible numbers with the curve arguments transposed parses cleanly and renders as spaghetti, and
// a variable font baked at the wrong master renders as a real font that is simply not the one asked
// for. Neither is visible in a diff.
//
// So the image puts the two side by side: the top row is three.js TextGeometry built from the
// generated outlines; the bottom row is the SAME string set in the original woff2 by the browser,
// at the same weight. If the pipeline is honest, they are the same typeface.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { serveRepo, SANDBOX_ARGS } from '../../harness/lib/render-harness.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const name = process.argv[2] || 'Anybody';
const text = process.argv[3] || 'Handgloves 123';

const typefaceRel = `assets/fonts/3d/${name}.typeface.json`;
const typefacePath = path.join(repoRoot, typefaceRel);
if (!fs.existsSync(typefacePath)) {
  console.error(`\n✗ ${typefaceRel} does not exist. Run: node generators/fonts/glyphs.mjs ${name}\n`);
  process.exit(1);
}
const meta = JSON.parse(fs.readFileSync(typefacePath, 'utf8')).vawe;

const { server, port } = await serveRepo();

// The jsm addons import a bare "three" specifier, which a browser cannot resolve on its own.
const html = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"/node_modules/three/build/three.module.js",
  "three/addons/":"/node_modules/three/examples/jsm/"
}}</script>
<style>
  @font-face { font-family: 'Ref'; src: url('/${meta.source}') format('woff2'); font-weight: 1 999; }
  html,body { margin:0; background:#ffffff; }
  #gl { display:block; width:1200px; height:340px; }
  .ref { font-family:'Ref'; font-weight:${meta.weight ?? 400}; font-size:132px; color:#0f1620;
         padding:22px 40px; letter-spacing:0; white-space:nowrap; }
  .tag { font-family:ui-monospace,monospace; font-size:15px; color:#697182; padding:4px 40px; }
</style>
<div class="tag">three.js TextGeometry &lt;- ${typefaceRel} (weight ${meta.weight ?? 'static'})</div>
<canvas id="gl" width="2400" height="680"></canvas>
<div class="tag">browser text &lt;- ${meta.source} (the same woff2, same weight) - these must be the same typeface</div>
<div class="ref">${text}</div>
<script type="module">
import * as THREE from '/node_modules/three/build/three.module.js';
import { FontLoader } from '/node_modules/three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from '/node_modules/three/examples/jsm/geometries/TextGeometry.js';

const data = await (await fetch('/${typefaceRel}')).json();
const font = new FontLoader().parse(data);

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setClearColor(0xffffff, 1);
const scene = new THREE.Scene();

const geo = new TextGeometry(${JSON.stringify(text)}, {
  font, size: 100, depth: 22, curveSegments: 8,
  bevelEnabled: true, bevelThickness: 2, bevelSize: 1.6, bevelSegments: 3,
});
geo.computeBoundingBox();
geo.center();
const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.1 }));
// A slight yaw so the EXTRUSION is visible; a head-on shot cannot be told from flat 2D text.
mesh.rotation.y = -0.34; mesh.rotation.x = 0.10;
scene.add(mesh);

scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-2, 3, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 1.2); rim.position.set(3, -1, 2); scene.add(rim);

const b = geo.boundingBox;
const cam = new THREE.OrthographicCamera(b.min.x - 40, b.max.x + 40, b.max.y + 40, b.min.y - 40, -3000, 3000);
cam.position.z = 900;
renderer.render(scene, cam);
window.__glyphsReady = true;
window.__glyphCount = Object.keys(data.glyphs).length;
window.__vertexCount = geo.attributes.position.count;
</script>`;

const tmp = path.join(repoRoot, `_glyphs-verify-${name}.html`);
fs.writeFileSync(tmp, html);

const browser = await puppeteer.launch({ headless: true, args: [...SANDBOX_ARGS, '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1240, height: 620, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/${path.basename(tmp)}`, { waitUntil: 'networkidle0' });
try {
  await page.waitForFunction('window.__glyphsReady === true', { timeout: 30000 });
} catch {
  console.error('\n✗ the page never finished building the geometry:\n  ' + (errors.join('\n  ') || '(no error reported)') + '\n');
  await browser.close(); server.close(); fs.rmSync(tmp, { force: true });
  process.exit(1);
}
const stats = await page.evaluate(() => ({ glyphs: window.__glyphCount, verts: window.__vertexCount }));
const out = `/tmp/glyphs-${name}.png`;
await page.screenshot({ path: out });
await browser.close(); server.close(); fs.rmSync(tmp, { force: true });

// FontLoader reports a missing glyph via console.error and then silently substitutes '?'. That is a
// substitution, so it is a failure here, not a warning.
const missing = errors.filter((e) => /does not exists in font family/.test(e));
if (missing.length) { console.error('\n✗ ' + missing.join('\n✗ ') + '\n'); process.exit(1); }
if (!stats.verts) { console.error('\n✗ TextGeometry produced ZERO vertices. The outlines parsed to nothing.\n'); process.exit(1); }

console.log(`  ✓ ${name}: ${stats.glyphs} glyphs in the file, ${stats.verts} vertices extruded for "${text}"`);
console.log(`  → ${out}, LOOK AT IT: the two rows must be the same typeface.`);
