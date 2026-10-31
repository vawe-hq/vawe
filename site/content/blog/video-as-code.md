---
title: "Video as code: what it is and how to start"
description: "Video as code means a film is a text file that a program renders. Three approaches, one tiny example each, and when not to use it."
date: 2026-10-19
updated: 2026-10-19
section: how-to
topic: how-to
docs: video-from-code, quickstart
tags: "video as code, programmatic video, ffmpeg, remotion, html to video"
keywords: "video as code, video editing as code, declarative video, programmatic video generation, code to video"
---

Video as code means a film is a text file, and a program turns the file into a video. You change the text, run the program, and get a new video. There is no timeline to drag.

The same file gives the same video. You can keep it in version control and review a change as a diff. You can also render many variants from one source. This post shows three approaches and one small example for each.

## Approach 1: a command line that edits

You describe the edit as a command. ffmpeg is the common tool. This command makes a 3-second title that fades in on a dark background:

```bash
ffmpeg -y -f lavfi -i "color=c=0x0b0d12:s=1280x720:d=3:r=30" \
  -vf "drawtext=text='one page, one film':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2:alpha='min(1,max(0,(t-0.4)/0.6))'" \
  -pix_fmt yuv420p out.mp4
```

We ran it with ffmpeg 8.0. It wrote a 1280 by 720 file with 90 frames and 3.0 seconds, 10.9 KB, in about half a second. It is fast and needs no browser. It is also hard to read once the edit has more than a few layers, because each effect is a filter string.

## Approach 2: components that draw one frame

You write a function of the frame number. The tool calls it for every frame and encodes the result. Remotion does this with React. Its fundamentals page (read on 2026-10-16) says it gives you "a frame number and a blank canvas". This is the example from that page:

```tsx
import { AbsoluteFill, useCurrentFrame, Composition } from "remotion";

export const MyComposition = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      Frame {frame}
    </AbsoluteFill>
  );
};

export const RemotionRoot = () => (
  <Composition
    id="MyComposition"
    component={MyComposition}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

We did not run this example. We copied it from the docs. Manim works the same way for math scenes in Python: its quickstart (read on 2026-10-16) renders a `Scene` class with `manim -pql main.py CreateCircle`. You get a full programming language. You also need to know the framework, and you write your animation with its helpers.

## Approach 3: a web page that the renderer seeks

You write one HTML page with CSS animation. A headless browser pauses the page, sets the time, takes a screenshot, moves to the next time, and ffmpeg joins the screenshots. You write in HTML, CSS, SVG, canvas or three.js, which you may already know.

vawe is a renderer of this kind. Here is a page and the command:

```html
<!doctype html>
<meta name="duration" content="3">
<style>
  body { margin: 0; background: #0b0d12; color: #f4f6fb; font: 700 calc(var(--vh) * 0.08) system-ui; }
  h1 { position: absolute; left: 8%; top: 40%; animation: rise 0.6s var(--ease-land) both 0.4s; }
  @keyframes rise { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
</style>
<h1 data-world="title">one page, one film</h1>
```

```bash
bin/vawe dev films/hello/page.html
```

We ran this pattern on a similar page: 90 frames at 30 fps, 960 by 540 pixels, in 5 to 6 seconds per draft. The steps are in [render HTML to MP4 with headless Chrome](/blog/render-html-to-mp4). The risk is the clock. A page that reads `Date.now()` or `Math.random()` can give a different video on each run, unless the renderer replaces the clock, as vawe does. See [determinism](/blog/determinism).

## How to choose

| Need | Approach |
|---|---|
| Cut, trim or join existing footage | 1 |
| Reusable, typed components and a React team | 2 |
| Motion graphics from web skills, or from an AI coding agent | 3 |
| Many variants from one data file | 2 or 3 |

For the data case, see [batch render videos from one HTML template](/blog/batch-render-videos).

## When not to use video as code

- You need one video, once, with complex footage. A timeline editor is faster.
- The film is mostly camera footage and cuts by feel. Code gives no gain there.
- Nobody on the team reads code. A change then needs a developer.
- You need a frame-exact match to a design file with no tolerance. Code gives a repeatable result, but you must tune it by hand.

## FAQ

**What is video as code?**
A film is a text file, and a program renders it to a video file. The text file is the source and the video is the output.

**Is video as code the same as programmatic video?**
Nearly. Programmatic video means a program makes the video. Video as code adds the idea that the source lives in files you keep and review like software.

**Do I need a browser?**
Only for approach 3, and for approach 2 in Remotion. ffmpeg alone needs none.

**Does vawe have a template feature?**
No. See [batch render videos from one HTML template](/blog/batch-render-videos) for the pattern we ran.
