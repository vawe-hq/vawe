---
title: "Image to particles in three.js: a step-by-step guide"
description: "Weight pixels by luma and edges, draw seeded points, light them by normal. 120,000 points in a 1.3 MB clip. Code included."
date: 2026-10-11
updated: 2026-10-16
section: motion-sound
topic: motion
docs: image-to-particles, three-and-canvas
tags: "image to particles, point cloud, three.js, seeded random, particles"
keywords: "image to particles three.js, photo to point cloud, convert image to particles, three.js particles from image, deterministic particles"
hero: /blog/image-points/hero.webp
heroAlt: "Timeline. Photo parallax was removed on 2026-10-01. imagePoints was added on 2026-10-11. Both decisions follow one question: does the move depend on processing the image?"
---

To turn an image into particles in three.js, give every pixel a weight. Draw points from those weights with a seeded random generator. Keep each point's colour, position and normal. The same photo then gives the same cloud on every render. Our `photo-particles` video component does this with a public-domain Hubble mosaic of the Crab Nebula. It becomes 120,000 points that gather from a seeded scatter over 1.5 seconds, then hold and breathe for 1.5 seconds.

The function is `imagePoints(image, options)` in `core/surfaces/image-points.js`. It has 144 lines.

## What we found

| Test | Result |
| --- | --- |
| Clip size of `photo-particles`, 120,000 points, filmed through the WebGL lens (the master `prompts/moves/photo-particles.mp4` is not tracked; `bin/vawe-dev moves --only photo-particles` renders it) | 1,342,076 bytes (about 1.3 MB), CRF 31, under a 2 MiB budget; the gallery copy is a separate encode of 2.48 MB |
| Clip size of the removed photo parallax video component | 29,964,958 bytes (about 30 MB) |
| Unit tests for `imagePoints` (`tests/*/image-points.test.mjs`) | 10 of 10 pass |
| Speed, 1,000,000 points from a 2048 by 1536 noise image, this machine | 1.16 s (the video component doc says about 0.5 s) |

![Clip sizes. The removed photo parallax clip was 29.96 MB. The photo particles clip is 1.34 MB, under a 2 MB budget.](/blog/image-points/size.webp "Clip sizes against the 2 MB budget.")

## Step 1: weight every pixel by what the eye reads

The density of points follows a weight for each pixel:

- Start from the luma above a threshold (default 0.04), raised to a gamma (default 1.6).
- Multiply by one plus an edge boost (default 0.5) times the edge strength. The edge is the Sobel magnitude, scaled to 1 at the strongest edge.
- Multiply by the mask, if there is one.

Brightness above a threshold, plus extra points on edges, keeps veins and silhouettes crisp.

![Pipeline. A photo, with an optional mask, depth and label image, becomes a weight per pixel. Seeded draws from the cumulative weight give the points. Each point has a position, a colour, a normal and a luma.](/blog/image-points/pipeline.webp "From photo to points.")

## Step 2: draw the points with a seeded generator

Each point is a seeded draw from the cumulative weight. The generator is the seeded `rng` from our motion module, never `Math.random`. So the same photo gives the same cloud on every render. A vawe page must paint each frame as a pure function of time, and the reasons are in [headless Chrome screenshots differ between runs](/blog/determinism).

## Step 3: give each point a colour, a position and a normal

Each point keeps the colour of its photo pixel. Its position puts the long side of the image from -1 to 1, with y up. Its z comes from a depth image, or from luma when there is none. Its normal tilts with the luma gradient. So a key light can shape the form: light a point by the dot product of its normal and the light.

## Step 4: split the cloud into parts

The `regions` helper takes a flat label image and gives each point the index of the label colour under it. A film can then move parts apart, such as the lid and iris of an eye, or the wings and body of a manta.

## Step 5: load the photo inside the frame hook

Load the photo inside the frame hook, not with a top-level `await`. The renderer seeks the first frame before a module that waits has finished, and that first frame comes out black.

## Step 6: film the cloud and fit the clip in a budget

We film the cloud through [our WebGL lens](/blog/real-lens) with the `film-halation` look. The clip was dense, so it was large. Every clip now has a 2 MB budget. The renderer encodes again at higher CRF steps until the file fits, and logs the CRF in `clips.lock.json`. The steps start at 16, go up by 3 and stop at 31. This clip ended at CRF 31. The budget code is `harness/lib/clip-budget.mjs`.

## Run it

This script builds a cloud from a small generated image, twice, and compares the two. Save it as `run.mjs` in the repo root. It needs only Node:

```js
import { imagePoints } from "./core/surfaces/image-points.js";

const w = 256, h = 192, data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const ring = Math.abs(Math.hypot(x - w / 2, y - h / 2) - 60) < 4 ? 255 : 30;
  data.set([ring, ring * 0.6, 255 - ring, 255], (y * w + x) * 4);
}
const image = { width: w, height: h, data };

const a = imagePoints(image, { count: 20000, seed: 3 });
const b = imagePoints(image, { count: 20000, seed: 3 });
console.log("same seed, same cloud:", a.positions.every((v, i) => v === b.positions[i]));
```

We ran it and it printed `same seed, same cloud: true`. In a page, pass a loaded `<img>` or canvas instead of the `{ width, height, data }` object. The result has `positions`, `colors`, `luma` and `normals` as typed arrays, ready for a three.js `BufferGeometry`.

We did not measure whether films made with the point cloud score higher. The video component came from a direct request for detailed particle subjects, and we judged it by looking at the clip.

## Why a photo video component was allowed after we deleted one

On 2026-10-01 we removed the video component `photo-parallax-2.5d`. Parallax on captured photos is not motion design. vawe animates designed things: type, shapes, UI, illustration and colour fields. A video component that cuts a captured image into depth layers, fakes camera depth inside it, tracks it or rotoscopes it is a footage technique. It depends on the photo and fails on an illustration. Its clip was 29,964,958 bytes.

We could have added an exception: "photos are allowed for particles". That is a second way to say one thing, and it leaves the next case unclear. We replaced the rule with a question: does the move depend on processing the image? Parallax depth cuts do. A card, a tile, a window or a carousel item that shows a photo whole does not. A particle form that uses the photo as a source of detail, and never shows it as footage, does not either. The moves README follows this question, and no agent prompt says "no photos".

For a public example film that puts a three.js scene through the same lens, see the [moth photogram example](https://github.com/vawe-hq/vawe/tree/main/films/examples/moth-photogram). The page rules for images are in the [backgrounds and images docs](/docs/backgrounds-and-images). The video component doc is `prompts/moves/photo-particles.md`. For the looks, curves and cuts around a video component like this one, read [CSS animation library: 126 copyable video components](/video-components).

## FAQ

**How do I convert an image to particles in three.js?**
Weight each pixel by brightness and edge strength. Draw points from those weights. Put the points in a `BufferGeometry` with the pixel colours. `imagePoints` in vawe does the first two steps and returns the arrays.

**How do I keep the particles the same on every render?**
Use a seeded random generator, not `Math.random`. With the same seed and the same image, the same cloud comes out. We test this.

**How many particles can I use?**
Our video component uses 120,000 points. Building 1,000,000 points from a 2048 by 1536 image took 1.16 s in our test on one machine.

**Why did the clip need a size budget?**
A dense point cloud encodes to a large file. We re-encode at a higher CRF until a clip fits 2 MB. This clip ended at CRF 31 and 1.3 MB.
