---
when: "a topic, paper or process must be explained with invented visuals and no product capture"
answers: "the facts-first explainer brief, the narration timeline rule, and the empty-to-complete process variant"
group: reference
---

# Story or explainer: facts first, invented visuals, a narration timeline

Brief shape: `bin/vawe new` writes Task, Look, Spec and Acceptance sections with numbers into brief.md; fill them as `prompts/ANATOMY.md` says.

**Use when** the film explains a topic, a paper, a process or a history, with visuals the agent
invents and no product capture. Route 3 in `guides/ROUTING.md`. The longest median
preview in the Opus 5.5 dataset (102 s) belongs to this type, so plan the length.

**Length:** 9 seconds to 3 minutes. Over 60 seconds, use the director's brief instead.

## The template

```
<inputs>
Ask me for: the source material (a link, a paper, a recipe, an outline), the audience in one line,
the three things they must be able to explain afterwards, the length, the canvas, and narration:
"none", a TTS voice with a timings file, or "captions only". If I skip one, take the default from
the Questions section and go on.
</inputs>

<facts>
Before any visual: list every factual claim the film will make, with its source and the line it
comes from. Mark anything you could not verify. Formulas, dates, numbers and names are copied, never
paraphrased. I check this list before you draw.
</facts>

<direction>
One idea per scene. The visual IS the explanation: a diagram that builds, a number that counts, a
process that fills from empty to complete. Type is for labels and the one sentence per scene, never
for paragraphs. One palette for the whole film, one accent for the thing being explained right now.
Banned: a slide with bullets, a stock icon grid, a narrator reading the on-screen text word for
word, a scene where nothing moves.
</direction>

<structure>
Write the scene list: scene | time | the one sentence the viewer takes away | what builds on screen
| the transition out. Each scene has ONE thing that changes. If narration exists, every scene start
is a word boundary from the timings file, not a guess. Show me the list before code.
</structure>

<build>
1. One page: films/<name>/page.html, <meta name="duration" content="<s>">, all assets relative.
2. Diagrams are SVG in the page. Their build is CSS @keyframes or element.animate() (stroke-dashoffset
   for a line that draws itself, a clip-path for a fill). The renderer seeks them.
3. Numbers count with a [[f, v]] table and kf(t, table, ease) from core/motion/springs.js, so the
   count is a pure function of time.
4. Captions: one <p> per line, timed with the same table as the narration. No em dash on screen.
5. Sound: a soft tick (<audio data-synth="pluck" data-gain="-8">) on the labels that matter, not
   every one; one "swell" (-6 dB) under the reveal. Narration: <audio src="vo.mp3" data-at="0">;
   music under it at data-gain="-12".
6. Draft, then read the sheet: bin/vawe dev films/<name>/page.html.
</build>

<gotchas>
A diagram that finishes building in 300 ms was not seen. A formula with a glyph the font lacks
renders a box; check the glyphs. A count that ends on a rounded number lies; count to the sourced
value. Captions and diagram must not share the caption band.
</gotchas>

<start>
Ask me for the inputs, write the facts list, stop. Then the scene list, stop. Then code.
</start>
```

## Variant: a process from empty to complete

One container, one continuous fill (a glass, a build log, a render queue). Every ingredient is
labelled as it enters, with its measure. Under 15 seconds this is one continuous action. Pattern from Ror Fly's cocktail-recipe request.

## Questions

Ask in this order; the first changes the film most. A skipped question takes its default; never wait.

1. **Source**: the material (a link, a paper, a recipe, an outline)? Default: https://vawe.dev/determinism (vawe's own page on determinism). Why: every claim is copied from it; without a source there is no facts list.
2. **Audience**: who watches, in one line? Default: an engineer who has used one video tool. Why: it sets the vocabulary and how much each scene explains.
3. **Takeaways**: the three things they must be able to explain afterwards? Default: the source's first three headings, verbatim. Why: one scene per takeaway is the structure.
4. **Length and canvas**: seconds and aspect? Default: 16:9, 30 s. Why: over 60 s the director's brief takes over, and the canvas sets the caption band.
5. **Narration**: none, captions only, or a TTS voice with a timings file? Default: captions only. Why: with narration every scene start is a measured word boundary, not a guess.

## Gotchas

- The agent cannot hear the narration it rendered. Mark "pronunciation not checked by the model"
  in the hand-off and have a person listen once.
- Density is information per frame: every scene shows the thing, it does not say the thing.
- Captions are a house block; do not reinvent their timing.

source: adapted from the CC BY 4.0 playbook by athemeroy, section 2 ("facts first, narration from
the same timeline, mark what the model could not hear"),
https://github.com/athemeroy/awesome-opus-5-5-videos/blob/main/docs/prompt-playbook.zh-CN.md;
the process variant from https://x.com/Ror_Fly/status/2102853258582880547 (via
https://github.com/guanmo-ai/awesome-ai-motion, case 2102853258582880547, third-party text, pattern
only); the Transformer explainer request https://x.com/dotey/status/2103683057689522564 for the
"high-school audience, high level AND detail" framing.
