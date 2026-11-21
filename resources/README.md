# Resources

Sites for the material a film is made of. Each line: name, link, what it has. Check a site's own licence before you use a file.

## Sound effects

- Kenney: https://kenney.nl/assets?q=audio : interface, impact and game sound packs
- Freesound: https://freesound.org : a large community library of sound effects and field recordings
- soundeffect-lab: https://soundeffect-lab.info : Japanese UI, button, impact and ambience effects
- Mixkit sound effects: https://mixkit.co/free-sound-effects/ : short effects by category
- ZapSplat: https://www.zapsplat.com : effects and some music
- Sonniss GDC bundle: https://sonniss.com/gameaudiogdc : yearly bundles of professional effects
- Envato Elements: https://elements.envato.com : subscription library of effects, music, footage, templates and fonts
- Motion Array: https://motionarray.com : subscription library of effects, music, footage and templates
- Artlist: https://artlist.io : subscription library of sound effects, music and footage

## Music

- Pixabay music: https://pixabay.com/music/ : free tracks by mood and genre
- Mixkit stock music: https://mixkit.co/free-stock-music/ : free tracks by mood and genre
- Epidemic Sound: https://www.epidemicsound.com : subscription library of music and sound effects
- Artlist: https://artlist.io : subscription music library
- Envato Elements: https://elements.envato.com : subscription music library

## Footage and photos

- Pexels: https://www.pexels.com/videos/ : free stock video and photos
- Pixabay: https://pixabay.com/videos/ : free stock video, photos and vectors
- Coverr: https://coverr.co : free stock video
- Unsplash: https://unsplash.com : free photos
- NASA media: https://www.nasa.gov/nasa-brand-center/images-and-media/ : space images and video
- Internet Archive, Prelinger collection: https://archive.org/details/prelinger : archival and ephemeral film
- Artlist: https://artlist.io : subscription stock footage
- Motion Array: https://motionarray.com : subscription stock footage and templates

## Fonts

- Google Fonts: https://fonts.google.com : open-licence families
- Fontshare: https://www.fontshare.com : free families from the Indian Type Foundry

## Textures and 3D

- Texturelabs: https://texturelabs.org : grain, paper, dust and surface textures
- Poly Haven: https://polyhaven.com : CC0 HDRIs, textures and 3D models
- Sketchfab: https://sketchfab.com : 3D models, many downloadable

## Animation

- LottieFiles: https://lottiefiles.com : Lottie animations and icons

## Design craft

Rules for interface and site work (type, motion, interaction, taste). `site/DESIGN.md` in vawe-hq/vawe-site records what the vawe site took from each.

- Practical Typography: https://practicaltypography.com/summary-of-key-rules.html : body size, line spacing, line length, caps tracking, quotes
- Interfaces cheat sheet: https://interfaces.dev/cheat-sheet : hit areas, focus, press scale, spacing between groups, font smoothing
- Web Interface Guidelines (Rauno): https://interfaces.rauno.me/ : hover on touch, 200 ms interactions, no weight change on select
- Interaction design (Rauno): https://rauno.me/craft/interaction-design : frequency and novelty, interruptible motion, Fitts on edges
- You don't need animations (Emil Kowalski): https://emilkowal.ski/ui/you-dont-need-animations : when not to animate, under 300 ms
- userinterface.wiki (Raphael Salaja): https://www.userinterface.wiki/ : durations by kind (press 120-180 ms), easing by direction; rules in github.com/raphaelsalaja/userinterface-wiki/skills
- Easing Graphs: https://www.easing.dev/ : named cubic-bezier curves (Out Quint, Quick Out, In Cubic) to copy exactly
- Laws of UX: https://lawsofux.com/ : Fitts, Hick, Jakob, Doherty (under 400 ms), proximity, Von Restorff
- Design System Checklist: https://www.designsystemchecklist.com/ : what a token set must cover (units, type, elevation, z-index, motion); text in github.com/ardakaracizmeli/design-system-checklist
- Taste Skill: https://www.tasteskill.dev/ : an agent skill against templated UI; pre-flight checks, audit-first redesigns
- Taste (shedsgns): https://shedsgns.me/taste : rhythm, hierarchy, restraint, "the right amount of nothing"
- The concept of taste (Raphael Salaja): https://www.raphaelsalaja.com/library/the-concept-of-taste : taste as learnable principles: hierarchy, proportion, clarity
- Devouring Details (Rauno): https://devouringdetails.com/ : paid interaction-design course with prototypes; principles list only is public
- Family values (Benji Taylor): https://benji.org/family-values : one family of components, delight inverse to frequency, motion that links screens

## Code and palettes: what may ship

Search before you build a gradient, easing, noise function, SVG filter or palette. "Verified" means the licence text was opened. Never compile code from a study-only source into a shipped film: read the technique and reimplement the idea.

- Safe to ship (MIT, BSD or CC0; keep the copyright notice in a copied source file):
  - Radiant (https://github.com/pbakaus/radiant): 106 GLSL shaders for light rays, caustics, bloom and auroras; single-pass demos that still need a port to a `(time, seed)` shape.
  - glsl-noise (https://github.com/hughsk/glsl-noise) and FastNoiseLite (https://github.com/Auburn/FastNoiseLite): portable noise to import into a new shader.
  - glsl-fast-gaussian-blur (https://github.com/Jam3/glsl-fast-gaussian-blur): a cheap separable blur for bloom.
  - d3-ease (https://github.com/d3/d3-ease) and easing-js (https://github.com/danro/easing-js): the Penner easing canon, JS functions to check a curve against, not CSS curves.
  - Radix Colors (https://github.com/radix-ui/colors), Open Color (https://github.com/yeun/open-color), the Tailwind default palette (https://github.com/tailwindlabs/tailwindcss), uiGradients (https://github.com/ghosh/uiGradients): colour scales and named gradients to check against.
  - Poly Haven (https://polyhaven.com): CC0 HDRIs, textures and models.
- Free with terms (check the licence page of the clip): Pexels and Pixabay (no resale of unaltered files), Mixkit (a Free and a Restricted tier per clip; no redistribution of the file), Coverr (attribution unless Coverr+; no AI training), NASA media (public domain, keep the insignia out).
- Study only (non-commercial, unlicensed or unclear; read the technique, do not copy code): LYGIA (Prosperity licence, a 30-day commercial trial), Shadertoy (CC BY-NC-SA by default), glslsandbox (per-shader licences unstated), The Book of Shaders (all rights reserved), yoksel/svg-filters (no LICENSE file).
- Rejected as sources: Adobe Color and single-purpose gradient pickers (tools with nothing to verify).
