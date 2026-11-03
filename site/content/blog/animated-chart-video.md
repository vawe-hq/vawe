---
title: "Animated chart video: render a bar chart to MP4 from code"
description: "Make an animated bar chart video with HTML and a seek function, render it to MP4 with vawe, and batch one chart per dataset with --param. Code that ran."
date: 2026-11-03
updated: 2026-11-04
section: how-to
topic: how-to
docs: data-story, batch-from-data, time-and-seek
tags: "animated chart video, bar chart to mp4, data video, count up, batch render"
keywords: "animated chart video, animated bar chart mp4, chart to video code, data visualization video html, bar chart animation render"
hero: /moves/chart-build.hd.webp
heroAlt: "A frame from the chart-build move: seven grey bars of weekly active users, with the newest bar in red and a 26.8k tag."
---

To make an animated bar chart video from code, draw the chart in HTML, set each bar's height and number from the time `t` in a `window.seek(t)` function, and render the page to MP4 with a renderer that seeks it frame by frame. The page below does that in about 50 lines, and one command renders a second chart from other data.

The renderer here is [vawe](https://github.com/vawe-hq/vawe), and the command is `bin/vawe dev films/chart/page.html --whole`.

![A frame from the chart-build move: seven grey bars of weekly active users, with the newest bar in red and a 26.8k tag.](/moves/chart-build.hd.webp)

## Why draw the chart yourself

A chart library is built for a screen: it animates when you load the page and then waits for a click. A video needs the opposite. You need the chart at an exact second, every time. If each bar height is a function of `t`, you get that.

A bar chart is a table drawn with rectangles. The table is data and the drawing is a formula. This keeps the video honest: every number on screen comes from the table, so a bar and its label cannot disagree.

## The page

The page has a data object with two years. It reads the year from the URL, builds the bars, and moves each one in `window.seek(t)`. Each bar starts 0.35 seconds after the one before, and takes 1.2 seconds with an ease-out curve. The number above the bar counts up with the bar. We rendered it:

```html
<!doctype html>
<html data-aspect="16:9">
<head>
<meta charset="utf-8">
<meta name="duration" content="5">
<meta name="message" content="a bar chart is a table drawn by t">
<title>Chart</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b0d12; overflow: clip; }
  .world { position: absolute; inset: 0; padding: 12vh 10vw 10vh; box-sizing: border-box; font-family: system-ui, sans-serif; color: #f4f6fb; }
  h1 { margin: 0 0 4vh; font-size: 6vh; }
  .bars { display: flex; align-items: flex-end; gap: 3vw; height: 55vh; border-bottom: 2px solid #2a3142; }
  .bar { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; }
  .fill { width: 100%; background: #3291ff; border-radius: 6px 6px 0 0; height: 0; }
  .val { font-size: 4vh; font-weight: 700; margin-bottom: 1vh; font-variant-numeric: tabular-nums; }
  .name { margin-top: 1.5vh; font-size: 3vh; color: #8fa3c8; text-align: center; }
</style>
</head>
<body>
<div class="world" data-world="chart">
  <h1 id="title"></h1>
  <div class="bars" id="bars"></div>
  <div class="bars" id="names" style="border:0;height:auto"></div>
</div>
<script>
  const sets = {
    2024: { title: "Renders per week, 2024", rows: [["Q1", 120], ["Q2", 340], ["Q3", 510], ["Q4", 880]] },
    2025: { title: "Renders per week, 2025", rows: [["Q1", 1100], ["Q2", 1500], ["Q3", 2300], ["Q4", 2900]] },
  };
  const set = sets[new URLSearchParams(location.search).get("year") ?? 2024];
  const max = Math.max(...set.rows.map((r) => r[1]));
  document.getElementById("title").textContent = set.title;
  document.getElementById("bars").innerHTML = set.rows.map(([, v]) => `<div class="bar"><div class="val">0</div><div class="fill"></div></div>`).join("");
  document.getElementById("names").innerHTML = set.rows.map(([n]) => `<div class="bar" style="height:auto"><div class="name">${n}</div></div>`).join("");
  const fills = [...document.querySelectorAll(".fill")];
  const vals = [...document.querySelectorAll(".val")];
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  window.seek = (t) => {
    set.rows.forEach(([, v], i) => {
      const p = ease(Math.min(1, Math.max(0, (t - 0.4 - i * 0.35) / 1.2)));
      fills[i].style.height = `${(v / max) * 100 * p}%`;
      vals[i].textContent = Math.round(v * p).toLocaleString("en-US");
    });
  };
  window.seek(0);
</script>
</body>
</html>
```

The height of a bar is `value / max`, so the tallest bar always fills the plot. The count is the same fraction of the value, rounded, so it ends on the exact number. The height of `0` in the CSS and the call `window.seek(0)` at the end give the first frame an empty chart.

## Render it

```bash
bin/vawe dev films/chart/page.html --whole --small --param year=2025
```

We ran this. The result is a 5 second MP4, 150 frames at 960 by 540 pixels. We read nine frames. At 0 s every bar is empty and every label says 0. At 0.7 s only Q1 has grown, to 636. At 1.43 s Q1 to Q3 read 1,097, 1,380 and 1,434 and Q4 is still 0. At 2.83 s all four read their final values: 1,100, 1,500, 2,300 and 2,900. They hold until 5 s.

## One chart per dataset

`--param` passes `key=value` to the page, which reads it with `new URLSearchParams(location.search)`. The output name gets the parameter, so two renders do not overwrite each other:

```bash
bin/vawe dev films/chart/page.html --whole --small --param year=2024
bin/vawe dev films/chart/page.html --whole --small --param year=2025
```

We ran both. They wrote `out/chart-year-2024-draft.mp4` and `out/chart-year-2025-draft.mp4`. The title and the four bars of each one come from its own row of data, and the page code is the same. `bin/vawe ship` takes the same flag for the final. The guide to [batch from data](/docs/batch-from-data) goes further. See also [render many videos from one template](/blog/batch-render-videos).

## Make it say one thing

A chart that animates every bar the same way says "here are four numbers". A chart in a launch film should say one thing. The library move [chart build](/video-components/chart-build) draws the gridlines first and raises the bars in grey. Then the newest bar turns to the accent colour and a tag pops onto it. One bar and one number are bright. Copy that idea: change the fill of the last bar in `seek` after it has finished growing.

For the number alone, see [count up](/video-components/count-up). For a whole data film with a story, the guide is [data story](/docs/data-story), and the video type is the [explainer video](/explainer-video).

## Things that go wrong

- A number that jumps in width. The `font-variant-numeric: tabular-nums` rule in our page gives every digit the same width, so the label does not shake as it counts.
- A bar that overshoots its value. Our ease-out curve never passes 1. If you use a spring, a bar can pass its value for a moment, and the label can read more than the data. That may be wanted, so check it.
- Data from a file. Our page holds its data as a literal. We did not test a CSV, so check a frame if you load one with `fetch` (see [page API](/docs/page-api) for the waits the renderer tracks).

We did not test a line chart or a chart race. A line chart is the same idea: move a point along a path from `t`. Look at a frame before you trust one.

## FAQ

**How do I make an animated bar chart video?**
Draw the bars in HTML, then set each bar's height and label in `window.seek(t)`. Render the page with vawe: `bin/vawe dev films/chart/page.html --whole`.

**Can I render a chart for each row of data?**
Yes. Read a parameter in the page and pass `--param key=value` to each render. We rendered two years from one page.

**Can I use D3 or Chart.js?**
Not by their own animation. A chart library that animates on load follows the clock. Use D3 for the scales if you like, and draw the frame from `t`.

**Does the number end on the exact value?**
Yes. The count is `round(value * p)`, and `p` reaches 1, so the last frame shows the value from the table. We read it in the render: 1,100, 1,500, 2,300 and 2,900.

**Where is the data?**
In the page, as a literal. A tunable number should be a literal, so the studio can edit it in place.
