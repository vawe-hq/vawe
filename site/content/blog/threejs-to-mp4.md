---
title: "Three.js to MP4: render a scene frame by frame"
description: "Render a three js animation to MP4 with one window.seek(t) function. No real clock, so the same page gives the same frames. Code and tests."
date: 2026-10-19
updated: 2026-10-19
section: how-to
nav: "Three.js to MP4"
topic: how-to
docs: three-and-canvas, time-and-seek
tags: "three.js, threejs to mp4, webgl, headless chrome, vawe"
keywords: "three js to mp4, render three js animation to video, threejs record video frame by frame, webgl headless chrome render, three js animation to video"
---

You have a three.js scene and you want an MP4 file. Do not record the screen. Write one function, `window.seek(t)`, that poses the scene for time `t` and renders one frame. A headless browser then calls it for each frame, and ffmpeg joins the screenshots.

<figure>
<video src="/blog/threejs-to-mp4/clip.mp4" poster="/blog/threejs-to-mp4/poster.webp" muted loop playsinline controls></video>
<figcaption>The page below, rendered by vawe: 3 seconds, 90 frames, 960 by 540 pixels.</figcaption>
</figure>

## Why not a render loop

A normal three.js page runs `requestAnimationFrame` and reads `THREE.Clock`. Both follow the real clock. So the cube is at a different angle each time a screenshot lands.

We tested it. We served a page with a cube that spins from `clock.getElapsedTime()`. We took 30 screenshots, took 30 more on a fresh page, and compared the hash of each frame. All 30 pairs differed.

## The page

Pose every object from `t` and from nothing else. Do not add to a value from the last frame.

```html
<!doctype html>
<meta charset="utf-8">
<meta name="duration" content="3">
<script type="importmap">{"imports":{"three":"/assets/vendor/three.module.min.js"}}</script>
<style>
  html, body { margin: 0; height: 100%; background: #0b0d12; overflow: hidden; }
  canvas { display: block; }
</style>
<canvas id="gl" data-world="cube"></canvas>
<script type="module">
  import * as THREE from "three";

  const w = innerWidth, h = innerHeight;
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("gl"), antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
  camera.position.set(0, 0, 6);

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a1d2a, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(3, 4, 5);
  scene.add(key);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x4f7cff, roughness: 0.35, metalness: 0.2 })
  );
  scene.add(cube);

  window.seek = (t) => {
    cube.rotation.set(0.4 + t * 0.5, t * 1.6, 0);
    cube.position.y = Math.sin(t * 2.1) * 0.25;
    renderer.render(scene, camera);
  };
  window.seek(0);
</script>
```

The import map points at `assets/vendor/three.module.min.js` in the vawe repo, which holds three.js 0.185.1. A page outside the repo needs its own path to a copy of three.js. The call `setPixelRatio(1)` fixes the frame size. The option `preserveDrawingBuffer: true` keeps the canvas readable until the screenshot.

## Render it with vawe

Save the page as `films/cube/page.html` and run the draft command:

```bash
bin/vawe dev films/cube/page.html
```

Our run wrote 90 frames at 30 fps and 960 by 540 pixels in 6.2 seconds. Capture took 3.6 seconds of that. We read the frame at 1.5 seconds and saw a lit blue cube, tilted, with soft shading on two faces. To install vawe, read [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4). For the same loop in plain Puppeteer, read [GSAP to MP4](/blog/gsap-to-mp4): the script works for any page that defines `window.seek`.

## What we ran for repeatability

We rendered the first second of the page twice with `bin/vawe dev --from 0 --to 1` and compared the decoded frames with `ffmpeg -f framemd5`. All 30 frame hashes matched between the two runs.

We also ran the page in Puppeteer at 640 by 360 pixels, with the seek function called before each screenshot. We took 30 frames twice, and 0 of 30 differed. We tried `preserveDrawingBuffer: false` as well. In our run the 30 frames still came out and did not differ, so we did not hit a black frame. We keep it at `true` because the screenshot can read the canvas after the draw.

## The WebGL drift fix

In [the determinism post](/blog/determinism) we measured a different WebGL drift. A half-size draft used the Chrome downscale, and 117 of 154 captures differed between runs. The fix in `harness/media/render-page.mjs` is to capture at full size and let ffmpeg shrink the frames with `scale=...:flags=area`.

We did not reproduce the 117 of 154 figure for this cube. We ran only the fixed path. The renderer captures the draft at full size and ffmpeg scales it. Two runs matched in all 30 frames. A single cube on one machine is a weak test, so treat it as a check that the fix does no harm.

## FAQ

**How do I render a three.js animation to MP4?**
Pose the scene from `t` inside `window.seek(t)` and call `renderer.render` there. Call `seek` for each frame in a headless browser, screenshot the canvas and join the frames with ffmpeg.

**Why does my three.js screenshot loop give a different video each time?**
A `requestAnimationFrame` loop and `THREE.Clock` follow the real clock. In our test, all 30 frames differed between two passes. Use a seek function instead.

**Can I use `Math.random` in the scene?**
Only with a seed. vawe seeds `Math.random` from the seek time. In plain Puppeteer you must seed it yourself, for example with a small generator that you reset on each call.

**Will two machines give the same pixels?**
Not always. A different GPU or Chrome version can change the pixels. On one machine, the same page gave the same frames in our tests.

For the full list of drift causes, read [headless Chrome screenshots differ between runs](/blog/determinism). For the clock that vawe replaces, read [seed Math.random and freeze Date.now](/blog/page-clock).
