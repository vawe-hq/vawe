---
title: "CSS animation library: 126 copyable video components"
description: "126 video components, each a page, a Markdown file and a clip. One CSS foundation, ten token sets called looks, and a contrast check."
date: 2026-10-11
updated: 2026-10-16
section: motion-sound
topic: site
docs: templates, product-ui
tags: "css animation library, motion design system, design tokens, video components library, open source"
keywords: "css animation library, copy paste css animations, motion design system, design tokens for video, easing functions"
hero: /blog/site-after-json/pipeline.webp
heroAlt: "Flow diagram: a video component is a markdown file and a demo page. One script builds a JSON index, copies the markdown, writes the llms.txt list and renders clips only when the source hash changed."
---

Our site is a CSS animation library. It is a gallery of 126 video components, and each video component is a clip, a short explanation and a snippet that you copy. All video components share one design system: one CSS file, ten token sets called looks, and a contrast check. It began as a replacement for a marketing site that still sold a scene format we had deleted. It grew from 70 video components to 126.

Films are plain web pages, as the [page contract for rendering HTML to video](/blog/page-contract) describes, and the site had to show that. This post covers how a video component is published, how the design system keeps the clips consistent, and what we got wrong.

## What we found

| What | At launch | Now |
| --- | --- | --- |
| Video components in `site/lib/moves.json` | 70 | 126 |
| Groups | 6 | 7 |
| Looks | 8 | 10 |
| Jobs (what a video component is for) | 33 | 60 |
| MP4 clips in `site/public/moves` | not counted | 121, 27.3 MB in total |
| Largest clip | not counted | 2.48 MB (`photo-particles`); two clips are above the 2 MiB budget |

We counted the "now" column from `moves.json` and the clip files on 2026-10-16. We did not measure traffic or conversion for this change, and we cannot yet say how many people copy a video component.

## A home page for a product that no longer existed

We had deleted the JSON scene format ([HTML vs JSON video format](/blog/html-over-json) lists what went). The site still carried the engine copy, the editor, the playground and a `/json-to-video` page. The home page promised JSON scene files, an editor and an MCP server. None of those existed any more.

One change removed the engine copy, its data and the pages built on it. It touched 1,792 files, added 511 lines and removed 127,750. It deleted `site/public/{core,blocklib,scenes,themes,vendor,films}` and the `/arsenal`, `/editor`, `/playground` and `/json-to-video` routes. The old `/arsenal` URLs now answer 308 and point to `/video-components`, and `/json-to-video` is a permanent redirect to the HTML to MP4 quickstart. The old routes stay in the git tag `arsenal-final`.

We removed first and built second. The removed routes redirected to `/`, and `/arsenal` did so only "until the /video-components gallery exists". That worked only because the gallery landed the same day. A redirect to the home page is a hole. Next time we would land the replacement first.

## One video component, published three ways

A video component is a short, proven piece of motion: a title that rises under a mask, a caret that types, a counter that dives. Each video component lives in `prompts/moves` as a Markdown file with a demo page. `scripts/site/moves.mjs` does four jobs:

- It builds `site/lib/moves.json`.
- It copies each `.md` file to `site/public/moves`, so an agent can fetch the video component as plain text.
- It writes the Video components section of `llms.txt`.
- With `--clips`, it encodes an H.264 MP4, a VP9 WebM and a WebP poster for each clip.

![Pipeline: a markdown file and demo page become a JSON index, a copy for agents, an llms.txt list and clips](/blog/site-after-json/pipeline.webp "From a video component file to the site.")

The gallery filters by group, look and job, and it searches by name and job. Clips play only while in view, six at most at a time. With reduced motion they play on tap. A video component page, for example [/video-components/lens](/video-components/lens), shows the clip, the snippet with a copy button, and the other video components that do the same job.

## Keep 121 clips fresh without rendering 121 clips

Rendering every clip for every edit wastes time when an edit touches one video component. `bin/vawe moves` renders only stale clips. A source hash for each clip lives in `clips.lock.json`. A clip is stale when its demo, `demo.css` or an imported `core/` file changed. `--all` forces every clip.

Each clip also has a 2 MiB budget (`CLIP_BUDGET_BYTES` in `harness/lib/clip-budget.mjs`). The encoder retries a clip over budget at higher CRF steps, from 16 up to 31, and logs the CRF in the lock file. The [x264 preset benchmark](/blog/encode) covers the encode choices.

## Easing pages generated from the engine

The site has 45 easing pages, generated from `core/motion` by `scripts/site/easing.mjs`, so a page cannot disagree with the code. The [CSS easing functions cheat sheet](/blog/easing) explains the named curves, and the page for [`land`](/easing/land) shows the format.

## Why a motion library needs a design system

By the end of September the library held between 53 and 70 clips. We had written each demo page alone, so the gallery read as a pile. The clip is the evidence for a video component. If the colours and type change from clip to clip, a reader cannot tell which differences belong to the video component.

We had also seen the opposite failure. Every film made with vawe looked like the same UI kit. Our old JSON scene format shipped a block catalog of 181 files, with pieces such as `barChart`, `bento` and `codeBlock`. Each block came with defaults for radius, border, shadow and type. An agent that follows defaults gets the defaults, whatever the brief says.

So the system has two jobs. It gives the library one language, and it keeps that language from becoming a house style.

## Blocks carry structure, looks carry style

A headless component carries structure and behaviour and no styling. A block owns structure only. The theme owns radius, borders, depth and type treatment. When a film needs a hero element that no theme can restyle, the film takes a copy of the element and owns it. The block catalog went away with the JSON format. The idea survived in the video component demos.

Every video component demo links one stylesheet, `prompts/moves/demo/demo.css`. A demo picks its look with one attribute:

```html
<html data-look="paper">
```

A video component written for one look runs in all ten. The foundation holds what every look inherits:

| Layer | What it fixes |
| --- | --- |
| Type | Six sizes as a share of frame height: hero 18, title 11, head 7.6, lead 6, body 4.8, small 3.8 (`--u` is 1 percent of the height) |
| Space | Five steps, `--s1` to `--s5`, from 1.2 to 7 units; one 12-column grid |
| Shape | Seven radius steps and three line weights |
| Colour | Roles, not colours: ground, surface, raised, hover, ink, muted, accent and on-accent, plus a paper pair for a cut |

Because type is sized from frame height, a frame at any size keeps its proportions. A look changes colour, faces, which radius and line steps it picks, and its depth. It never changes a size or a class. So a look is a token set, and it cannot add a layout rule or rename a class.

## The ten looks

The ten are vawe (cool near-black and cobalt), daylight, terminal, swiss, paper, dusk, brutal, signal, field and chrome. The Looks section of `prompts/moves/README.md` gives each one a job. Terminal is for typing and streams. Paper is for quiet editorial type. Brutal is for hits on the beat. Chrome is for physical objects such as plates and flaps.

![Ten video component stills in two rows, one from each look](/blog/ten-looks/ten-looks.webp "One video component from each look, in the order vawe, daylight, terminal, swiss, paper (top row), dusk, brutal, signal, field, chrome (bottom row).")

## Stop every clip picking the same look

Ten looks do nothing if every clip picks the same one. The README has an assignment rule. Inside a group, a look appears at most twice, with an allowance for the biggest group. Adjacent video components in a group list differ. Product-UI video components take product looks, type video components take editorial looks, and transitions take colour-led looks first.

The assignment is one `data-look` per demo file, so a grep shows the spread. In the current tree 120 demos carry a look. The counts run from `vawe` with 22 down to `chrome` with 7.

## The rule that was hardest to keep: faint is never text

Every look defines a `--faint` colour for dots, rules and icons. It is low contrast by design, so it must never carry words. `prompts/moves/demo/contrast.mjs` reads every look in `demo.css` and checks WCAG contrast. Ink, muted, on-accent and paper text must pass 4.5 to 1. Accent used as text must pass 3 to 1, for large type only. The check caught one real fault. The swiss "up" ink (the red of a rising number) was too light. We darkened it from `#d40500` to `#c40400`, and it now passes 4.5 to 1.

![Diagram: the demo.css foundation feeds ten looks, which pass through contrast.mjs and become clips rendered once](/blog/ten-looks/system.webp "One foundation, ten looks, one contrast check.")

We recorded which public skills shaped the pass. We used better-typography for measure and tabular figures, better-ui for concentric radius, and baseline-ui for a spacing review. We rejected three sets of defaults. A film sets its own sizes, so the 16 px body floor goes. Several looks need gradients and letter spacing, so those rules go. A film has no input, so every hover and press rule goes.

## Copy a video component and check the looks

A video component is a Markdown file with a snippet. This is the core of `mask-rise`, copied from `prompts/moves/mask-rise.md`:

```css
.mask { overflow: hidden; padding: 0.1em 0.1em 0.25em; margin: -0.1em -0.1em -0.25em; }
.mask > span { display: block; translate: 0 118%;
               animation-name: rise; animation-duration: 0.7s;
               animation-fill-mode: both; }
@keyframes rise { to { translate: 0 0; } }
```

```html
<h1 class="mask"><span>typography</span></h1>
```

<figure>
<video src="/moves/mask-rise.mp4" poster="/moves/mask-rise.webp" muted loop playsinline controls></video>
<figcaption>The mask-rise clip from the gallery. The padding keeps the descenders of g, y and p from being cut.</figcaption>
</figure>

The full snippet also sets `animation-delay` and `animation-timing-function` from custom properties. Run the contrast check on all looks:

```bash
node prompts/moves/demo/contrast.mjs
```

We ran it and the last line was `10 looks, 0 failing pairs`. To render only the clips that changed, run `bin/vawe moves`. Add `--only <name>` for one video component.

A video component you copy from the gallery carries neutral tokens, so it takes the look of the page you paste it into. We have no before-and-after number for the design system. We did not score the old block catalog against the new tokens, and we never timed a full render against an incremental one. The outcome is what we can show: the catalog is gone, and ten looks make visibly different films from the same class names.

## FAQ

**Where can I find copy-paste CSS animations?**
The vawe video components gallery at [/video-components](/video-components) has 126 video components. Each one has a clip, a plain explanation and a CSS and Web Animations snippet you copy.

**What is a motion design system?**
It is the shared set of sizes, colours, type and motion rules that every clip in a library draws from. In ours, one CSS file sets sizes and ten token sets change the colour and type.

**How do you keep a library of animations consistent?**
Fix the sizes in one foundation, let each look change only tokens, and check contrast in code. Ours fails if a look has a text pair below 4.5 to 1.

**Why did you delete the JSON format site pages?**
The format lost a blind test to plain HTML, and the pages sold a product that no longer existed. We removed them in one change and redirected the old URLs.
