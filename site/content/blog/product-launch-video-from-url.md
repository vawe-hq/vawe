---
title: "Product launch video generator from a website URL"
description: "Capture a site, read its palette and type, and build a launch film from the real UI. The steps, a 9 s example and the mistakes."
date: 2026-10-19
updated: 2026-10-19
section: how-to
topic: how-to
docs: launch-video, product-ui, brand-reflection
tags: "product launch video, saas promo video, website to video, brand kit, vawe"
keywords: "product launch video from website, saas promo video generator, create launch video for github project, website to video, launch video from url"
---

To make a product launch video from a website URL, capture the real site first. Read its colours and fonts from the pixels. Build every shot from those captures, and never invent a screen. This post shows the three commands we ran, the 9-second film they gave, and the mistake we made on the first draft.

## The idea: capture first, animate second

A launch film that shows an invented mockup tells the viewer nothing about the product. A film built from the real site shows what the product looks like today. So the work has two parts. First a script crawls the site and records what it finds. Then you write one HTML page that moves those captures.

## Step 1: build a kit from the URL

The kit script screenshots each section of the page, reads the dominant colours and finds the icon. We ran it on the vawe site, served on our own machine:

```bash
node scripts/brand/kit.mjs http://127.0.0.1:3977/ blogdemo
```

It captured 10 sections and wrote `assets/brands/blogdemo/kit.json`. Its last lines were:

```text
✓ kit → assets/brands/blogdemo/kit.json
  10 sections · DARK-first · bg #010101 · text #ffffff · accents #317fdd #2d4817 #162909 · favicon favicon.png
```

The script says "dark-first" because it measured the pixels. A white site gets a white film. It also prints a storyboard with one beat for each section, in the order of the site. We pointed it at `vawe.dev` first, and the capture timed out after 45 seconds on our machine. The local copy of the same site worked.

## Step 2: start from the launch template

```bash
bin/vawe new my-launch --from prompts/brand-launch-from-url.md
```

The template asks for the URL, the one-line promise, three to five moments worth showing, the platform and length, and music. It allows only the kit and real captures. It says a launch film is 15 to 40 seconds. Under 15 seconds, it is one continuous action.

## Step 3: write the page and render a draft

Copy the captures you need into `films/<name>/assets/`. Our example uses two: the hero section and the gallery of video components. The page has three scenes. The first pushes slowly into the real hero. The second shows the real gallery. The third is the wordmark in the kit colours.

```bash
bin/vawe dev films/blogdemo/page.html
```

The draft took 16 seconds. It is 9 seconds long, 960 by 540 pixels, and the clip below is 207 KB.

<figure>
<video src="/blog/product-launch-video-from-url/launch-example.mp4" poster="/blog/product-launch-video-from-url/launch-example.webp" muted loop playsinline controls></video>
<figcaption>A 9 s draft built from two real captures of vawe.dev.</figcaption>
</figure>

This film is short and plain. It is a proof that the route works, not a finished launch film. A real one has one message for each beat, a cursor that does one real thing, and sound.

## The mistake we made

Our first draft put a large caption, "One page in. One film out.", over the hero capture. The capture already holds that headline, so two copies of it overlapped. We removed the caption and used a small mono label instead. The rule is simple: if the capture says it, do not say it again on top.

We also tried to crop the gallery capture to one tile at a time. The tiles are small, and a tight crop made the labels unreadable. We now show the whole gallery and let it settle into place.

## Three rules from the template

1. Every screen is a crop of a real capture. A feature you did not see on the site is a feature you must not show.
2. Use the kit palette. Do not improve it.
3. Crawl past the homepage. The feature worth showing is often one click past the hero.

The page that explains the route is [launch video](/launch-video). To show one feature at a time, see [product showcase videos](/product-showcase-video); for a topic with nothing to sell, see [explainer videos](/explainer-video). The kit step is in the [brand reflection guide](/docs/brand-reflection). To see what render and draft do, read [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4).

## FAQ

**Can I make a product launch video from a website URL?**
Yes. Run the kit script on the URL, and it captures each section and reads the palette. Then write one HTML page that animates those captures and render it.

**Does it work for a GitHub project?**
We ran it only on our own site. The script needs a URL that headless Chrome can load, so a project site should work. We did not test one.

**How long should a launch video be?**
The template says 15 to 40 seconds. Under 15 seconds, use one continuous action.

**Does the tool invent screens?**
No. The template allows only the kit and real captures. We did not test it on a site with a login wall.

**Do I need an agent?**
No. You can write the page yourself. An agent can write it from the same template.
