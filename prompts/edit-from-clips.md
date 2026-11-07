---
when: "the person gives their own clips and wants them edited into one film"
answers: "the edit template: log the footage, write a Cut list, then trim, order, speed, titles, captions, grade and music in one page"
group: reference
---

# Edit from the person's clips

Brief shape: `bin/vawe new <name> --footage <folder|clip>...` copies the clips, writes `footage.md` and a brief with a Cut list.

**Use when** the person gives clips and wants one film from them. The clips are content moved whole: trim, order, speed, titles, captions, a grade with the lens, transitions, music. Footage processing (tracking, roto, depth cuts) is out of scope (`prompts/moves/README.md`, Scope).

**Length:** the sum of the kept parts, usually 8 to 60 seconds.

## The template

```
Edit the clips in films/<name>/footage/ into one film: <the story in one sentence>.
Read footage.md first: each clip's length, shots, loudness and transcript with word times.
Fill the brief's Cut list: one row per world (clip, in, out, rate, why). Cut on an action or a word end.
Write films/<name>/page.html: each clip is a <video> inside its data-world beat (skills/vawe-page/SKILL.md, Video clips).
Add a title card and one caption per clip that needs one. Music only from a file the person gives.
```

## Questions

1. **Story**: what is the one thing the film says? Default: the clips in the order shot, trimmed to their best moment. Why: the cut list follows from the message, not from the clip order.
2. **Voice**: which clip speech must stay, and what may be cut? Default: keep speech whole, cut silence over 0.5 s. Why: a cut inside a word is the first thing a viewer hears.
3. **Music**: is there a track the person gives? Default: none; the clips' own sound with small effects on cuts. Why: a track only from a file the person gives (`taste/craft/sound.md`).
4. **Titles**: a title card and captions, or the clips alone? Default: one title card and a caption on clips that need context. Why: captions carry a film watched muted.
5. **Length and canvas**: seconds and aspect? Default: the sum of the cuts, 16:9. Why: the cut list sets the length; a clip is never cropped to fit another aspect.

## Gotchas

- Read `footage.md` before the first row. A cut chosen from the file name, not the frames, shows the wrong second.
- A clip never plays live: the page states `data-at`, `data-trim` and `data-rate`, and the engine seeks.
- Hide a clip with opacity in its world, never by removing it from the DOM.
- A clip held under 1.2 s reads as a flash. Keep the one fast cut for the beat that earns it.

source: ours.
