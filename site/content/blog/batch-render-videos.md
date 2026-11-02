---
title: "Batch render videos from one HTML template"
description: "Batch render videos from a template: fill one HTML page with JSON rows and render a clip per row with a Node loop. We ran three rows."
date: 2026-10-19
updated: 2026-10-19
section: how-to
topic: rendering
docs: batch-from-data, render-flags, cli
tags: "batch render videos, html template, node, automation, personalized video"
keywords: "batch render videos from template, automate social media video generation, personalized video from data, html template to video, render many videos node"
---

You want one video per row of data: one clip per user, product or post. This post shows how to batch render videos from one HTML template with a short Node script. We ran it for three rows and give the real times and sizes.

vawe has no template feature and no `--data` flag. A film is one `page.html` file, and `bin/vawe dev` renders that file. For a few small values, `--param key=value` passes them to the page (see below). For a whole row, the pattern is yours: write one page file per row, then render each file.

## The pattern

Keep the data in a JSON block inside the page. A small script reads the block and fills the text and the colour. Then a Node loop copies the template, swaps the JSON block for one row, and renders the copy.

The template is `template.html`:

```html
<!doctype html>
<meta name="duration" content="3">
<style>
  :root { --bg: #0b0d12; --accent: #4f7cff; }
  body { margin: 0; background: var(--bg); color: #f4f6fb; font: 700 calc(var(--vh) * 0.09) system-ui; }
  .card { position: absolute; inset: 0; display: grid; place-content: center; padding: 0 8%; }
  h1 { margin: 0; animation: rise 0.6s var(--ease-land) both 0.3s; }
  p { margin: 0.3em 0 0; font-size: 0.5em; color: var(--accent); animation: rise 0.6s var(--ease-land) both 0.6s; }
  @keyframes rise { from { transform: translateY(calc(var(--vh) * 0.04)); opacity: 0 } to { transform: none; opacity: 1 } }
</style>
<script type="application/json" id="data">{"title":"Hello","line":"First variant","accent":"#4f7cff"}</script>
<div class="card" data-world="title"><h1 id="t"></h1><p id="l"></p></div>
<script>
  const d = JSON.parse(document.getElementById('data').textContent);
  document.getElementById('t').textContent = d.title;
  document.getElementById('l').textContent = d.line;
  document.documentElement.style.setProperty('--accent', d.accent);
</script>
```

The data is `rows.json`:

```json
[
 {"id":"ada","data":{"title":"Ada Lovelace","line":"Joined 2026-01","accent":"#4f7cff"}},
 {"id":"grace","data":{"title":"Grace Hopper","line":"Joined 2026-03","accent":"#ff7a59"}},
 {"id":"alan","data":{"title":"Alan Turing","line":"Joined 2026-06","accent":"#3ecf8e"}}
]
```

The loop is `batch.mjs`. Put the three files in the vawe repo root and run it there:

```js
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const rows = JSON.parse(fs.readFileSync("rows.json", "utf8"));
const template = fs.readFileSync("template.html", "utf8");

for (const row of rows) {
  const dir = `films/batch-${row.id}`;
  fs.mkdirSync(dir, { recursive: true });
  const page = template.replace(
    /(<script type="application\/json" id="data">).*?(<\/script>)/s,
    `$1${JSON.stringify(row.data)}$2`,
  );
  fs.writeFileSync(`${dir}/page.html`, page);
  const t0 = Date.now();
  execFileSync("bin/vawe", ["dev", `${dir}/page.html`, "--no-judge", "--fast", "--out", `out/batch-${row.id}.mp4`], { stdio: "inherit" });
  console.log(`${row.id}: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${fs.statSync(`out/batch-${row.id}.mp4`).size} bytes`);
}
```

The page reads only the JSON block. It reads no clock and no random value, so each file renders the same way as any other vawe page. The rules are in [the page contract](/blog/page-contract).

## What we saw

We ran `node batch.mjs` with the three rows. Each draft is 90 frames at 30 fps, 960 by 540 pixels, 3.0 seconds. The times are the wall time of one `bin/vawe dev` call, from the loop.

| Row | Wall time | File size |
|---|---|---|
| ada | 5.6 s | 138,537 bytes |
| grace | 5.9 s | 143,522 bytes |
| alan | 5.3 s | 108,319 bytes |

The three rows took 16.8 seconds together. The loop is serial: one render at a time. The drafts have no sound. This is the clip for the row `grace`:

<video controls muted playsinline poster="/blog/batch-render-videos/grace.webp" src="/blog/batch-render-videos/grace.mp4" width="960"></video>

A draft is half size. For a full-size file, call `bin/vawe ship` instead of `bin/vawe dev`. That command needs an approved draft first. See the [CLI docs](/docs/cli).

## Pass a value with --param

A page can read one value from the command line. Repeat `--param key=value` for each one, and read them in the page:

```js
const title = new URLSearchParams(location.search).get('title');
```

The value is part of the render key, and the default output name gets it, so renders of two values do not overwrite each other. Use it for a look or a short label. Use the JSON block for a long row.

## Render more than one clip at a time

vawe limits renders for the whole machine. The default is 2 render slots, and `VAWE_RENDER_SLOTS` changes it (`harness/lib/render-slots.mjs`). A third render waits and prints one line that names the render that holds a slot. Start two loops on halves of your rows to use both slots. More slots than your memory allows will slow every render.

We did not run a parallel batch, so we give no speed-up number.

## What vawe checks on each page

`bin/vawe dev` also prints advice for each page. Our three test pages got advice such as "no brief.md next to the page" and "world held 3 s". The advice does not stop the render. For a batch, write one `brief.md` next to the template, or ignore the advice lines.

One example of a batch is a chart per dataset, shown in [animated chart video](/blog/animated-chart-video).

## FAQ

**Does vawe have a template or data feature?**
No data file feature. A film is one HTML file. `--param key=value` passes small values, and the JSON block pattern above fills a whole row. Any template tool that writes an HTML file also works.

**Can I pass data in a URL query string?**
Yes, with `--param key=value` on `dev`, `ship` and `frame`. The page reads it with `new URLSearchParams(location.search)`. We ran `bin/vawe frame` with `--param title=Ada` and the page showed "Ada". The batch loop above uses the JSON block, not `--param`.

**Can I use Puppeteer instead of `bin/vawe`?**
Yes, if you drive the page clock yourself. [Render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4) shows a 20-line script.

**How long does one clip take?**
Our three 3-second drafts took 5.3 to 5.9 seconds each on one machine. Time grows with length and frame size.
