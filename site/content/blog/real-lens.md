---
title: "Depth of field in CSS and WebGL: a measured test"
description: "CSS blur and text-shadow against one WebGL lens that films the page. Bloom measured 24.9 px against 20.7 px on a reference film."
date: 2026-10-11
updated: 2026-10-16
section: motion-sound
topic: motion
docs: lens-and-effects, backgrounds-and-images
tags: "depth of field, bloom, webgl, html to video, lens"
keywords: "depth of field in the browser, css depth of field, webgl depth of field, bloom effect css, halation shader"
hero: /blog/real-lens/hero.webp
heroAlt: "Pipeline diagram. A flat HTML screen becomes an SVG image, then a GL texture, then one lens shader applies perspective, depth of field, palette, LED mask, bloom, halation, aberration and grain."
---

For depth of field in the browser, CSS is enough for one element and a still frame: `filter: blur()` and `text-shadow` are cheap and easy. Use one image-space shader when the camera moves, or when the frame sits next to footage shot through a real lens. It treats the whole page as a flat screen and films it, so every effect agrees with every other.

We learned this when we put our first HUD film next to a reference filmed off a real monitor. Ours read as fake, and we could point at why. The glow was a CSS shadow, and the depth of field was one blur per plane. Optical effects are now a framework job in vawe.

## What we found

| | CSS on each element | One WebGL lens on the page |
| --- | --- | --- |
| Depth of field | `filter: blur()` per layer; every pixel in a plane gets the same blur | blur from distance, with aperture-shaped bokeh |
| Bloom | `text-shadow` on the element that asks for it | spreads from every bright pixel, tight core and wide tail |
| Perspective | CSS 3D transforms | a ray hits a tilted plane, so the far side is smaller and softer by geometry |
| Camera moves | each fake has its own idea of the image | one image, one camera |
| What the author writes | the effect on every element | a normal page, plus one lens choice |
| Cost | none beyond the browser | about 17 ms a frame on the GPU at 1080p |

We measured the lens demo against a filmed reference at 1080p. The numbers are in `prompts/moves/lens.md`.

| Measure | Lens | Reference |
| --- | --- | --- |
| Bloom, 90 to 10 percent width | 24.9 px | 20.7 px |
| LED panel period | 6.9 px | 7.1 px |
| Colour fringe, edges off by 1 px or more | 35 percent | 20 to 28 percent |

Bloom and panel period are close. The colour fringe is further off. No judge score says that films got better with the lens. The gain is our own side-by-side judgement against the reference, which is weaker evidence.

## Depth of field: blur per plane against blur by distance

A real defocus depends on the distance from the focal plane. Bright points take the shape of the aperture. `filter: blur()` gives every pixel in a layer the same radius and has no bokeh. Tuning it has a ceiling, because each blurred element works alone.

The lens does depth of field and perspective in one shader. The page does not know about the camera. The chain has four steps.

1. The page draws a `#screen` element of 1920 by 1080 px, behind the lens canvas.
2. The `htmlSource` function inlines the computed styles and fonts into an SVG image.
3. The image goes up as a GL texture on every seek.
4. One shader applies the camera.

The code is `core/surfaces/lens.js` (676 lines) and `core/surfaces/lens-source.js`.

## Bloom and halation: text-shadow against image-space light

A `text-shadow` lights the element that asks for it and nothing else. A real bloom spreads from every bright pixel in the frame. The shader applies bloom, palette mapping, an LED panel mask, aberration, tear and grain. It also has halation, anamorphic streaks, diffusion, soft focus, tilt-shift, distortion and gate weave.

<figure>
<video src="/blog/real-lens/lens.mp4" poster="/blog/real-lens/lens.hd.webp" muted loop playsinline controls></video>
<figcaption>The lens video component clip. Six stages, each on for one second: flat, perspective, depth of field, palette and aberration, bloom and LED grid, tear and grain.</figcaption>
</figure>

## Cost per frame

A frame costs about 17 ms on the GPU at 1080p (12 ms in a draft). A 6 second final of 360 frames captures in about 20 seconds. The CSS route costs nothing extra, and that is its real advantage.

The upload was the first cost to cut. The page rebuilds the SVG screen and uploads it on every frame of a seek. Now `htmlSource` inlines only the styles that differ from a bare element and its parent clone. The SVG image became about one tenth of its old size.

## Will a draft match the final?

A film renderer needs each frame to be a pure function of time. The lens draws the SVG screen into a software canvas, so the draft pixels match from run to run. All noise in the lens (grain, tear, weave) comes from a hash of a seed and `floor(t * fps)`. A test renders a lens page twice in parallel, with HTML that changes every frame, and compares the frames. The wider reasoning is in [headless Chrome screenshots differ between runs](/blog/determinism).

## Control: one property per element against named looks

Every lens option is a literal in the page: a number, an array, or a function of the seek time. The lens also has `project()`, which runs the same camera on the CPU. A label drawn in HTML on top of the canvas can then sit on the right pixel of the filmed screen.

The long option list became its own problem for agents. So the lens has a `LOOKS` table with ten entries: `clean`, `dream-bloom`, `film-halation`, `anamorphic`, `pro-mist`, `tilt-shift`, `soft-focus`, `vintage`, `cyanotype` and `crt`. A look names every effect it uses, and nothing else is on. The options of the page go over the look, and a preview override goes over both.

![Three layers of options. The preview override wins over the page options, which win over the named look. Ten look names are listed.](/blog/real-lens/looks.webp "Three layers of options.")

## Use the lens in a page

This is the example from the lens video component doc. The page draws `#screen` as plain HTML, and the lens films it:

```js
import { lens, htmlSource, PALETTES } from '/core/surfaces/lens.js';
const cam = lens(htmlSource(document.getElementById('screen'), { scale: 2 }), {
  aim: (t) => [1390, 520], zoom: (t) => 1 + 1.9 * ease(t), tiltY: 0.38, tiltX: 0.1,
  dof: { blur: 0.55, focus: [1400, 520] },
  palette: { stops: PALETTES.thermal, keepColor: 0.9 },
  bloom: { strength: 0.9, radius: 42 }, grid: { amount: 0.9, cell: 3 },
});
vawe.onFrame((t) => cam.draw(t));
```

This is a sketch of the call, not a page that runs on its own: `ease` is a function you supply. The full demo is `prompts/moves/demo/lens.html`. We rendered 2 seconds of it as a draft with `bin/vawe dev prompts/moves/demo/lens.html --from 1 --to 3`, and it finished in 8.9 s.

To pick a look by sight, run `vawe frame --looks`. It renders a page frame under every named look and prints one labelled grid per second:

```bash
bin/vawe frame prompts/moves/demo/lens.html --looks --at 2 --only clean,crt
```

We ran it and it wrote `out/looks-demo/looks-2s.png`: the page as is, plus two looks. Then put `look: '<name>'` in the lens options of your page.

## When to choose which

Use CSS when one element needs a soft glow, the camera does not move, and nobody will compare the frame with real footage. Use an image-space lens in three cases. The camera moves. Several effects must agree (blur, bloom and perspective on one plane). Or a reference was shot through glass. The [image to particles guide](/blog/image-points) shows a point cloud filmed through the same lens with the `film-halation` look.

See the clip and its code on the [lens video component page](/video-components/lens). For a framework that treats the browser as the renderer, compare [vawe with Remotion](/remotion-alternatives).

| File | What it holds |
| --- | --- |
| `core/surfaces/lens.js` | the shader, options, `LOOKS`, `resolveOptions` |
| `core/surfaces/lens-source.js` | `htmlSource` and the style-diff inlining |
| `harness/media/looks.mjs` | the `vawe frame --looks` contact sheet |

## FAQ

**Can CSS do real depth of field?**
No. `filter: blur()` gives every pixel in a layer the same blur, and it has no bokeh. For blur that grows with distance from a focal plane, use a shader.

**How do I add bloom in the browser?**
For one element, use `text-shadow` or `drop-shadow`. For bloom that spreads from every bright pixel, render the page to a texture and blur the bright parts in a shader.

**What does a WebGL lens cost per frame?**
About 17 ms on the GPU at 1080p in our test, and 12 ms in a draft. A 6 second final of 360 frames captured in about 20 seconds.

**Is the lens output the same on every run?**
Yes, on one machine. The shader noise comes from a hash of a seed and the frame number, and a test compares two renders.
