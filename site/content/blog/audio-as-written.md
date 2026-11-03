---
title: "LUFS for code-made video: set the loudness in the page"
description: "Our example film measured -28.8 LUFS against a -20 target. A plain mix, a limiter and one check fixed it. Why we also ban synth beds."
date: 2026-10-10
updated: 2026-11-04
section: motion-sound
topic: audio
docs: loudness-and-the-mix, audio
tags: "lufs, video loudness, audio mixing, true peak, background music"
keywords: "lufs for video, loudness target for generated video, measure loudness ffmpeg, true peak limiter, html video audio mix"
hero: /blog/audio-as-written/hero.webp
heroAlt: "A loudness scale from -34 to -14 LUFS. The colour-sting film measured -28.8 LUFS against a target near -20, a gap of about 9 dB."
---

LUFS (loudness units relative to full scale) measures how loud a whole video sounds, averaged the way an ear hears it. It is the number to check when you ask if a film is too quiet. Ours was: the example film `colour-sting` measured -28.8 LUFS against a target near -20, about 9 dB low. Nobody caught it by ear, because the agents that write our sound cannot listen.

So the measurement has to be the ear. This post shows the loudness target we use, the mix rule behind it, and why we ban the synthetic music bed.

![The mix as written: tags go into a sum, then a limiter at -1 dBTP that only lowers peaks, then the video. Every draft prints loudness.](/blog/audio-as-written/diagram.webp "The mix as written.")

## What we found

| Test | Result |
| --- | --- |
| `colour-sting` with the first default gains | -28.8 LUFS (target near -20) |
| `colour-sting` today, six cues, no bed, `vawe sound --waveform` | -19.9 LUFS, -6.2 dBTP |
| One cue of each palette voice, 5 cues in 6 s (`tests/media/sound-palette.test.mjs`) | passes between -22 and -18 LUFS, at or under -3 dBTP |
| Films with a constant synth bed, our own audit of 24 audio films | 4 of 24 |

The first default gains were a guess. Once every draft printed its loudness, the guess showed.

## Set a loudness target

We aim near -20 LUFS integrated. A draft warns outside the band -24 to -16 LUFS. True peak must stay at or under -3 dBTP. A band is easier to hit than one point, and it still catches a film that is far off.

Integrated loudness and true peak answer different questions. Loudness is the average the ear hears. True peak is the highest point of the waveform after reconstruction, which is what clips. The two limits can fight each other. Short, sharp cues cannot sit at -20 LUFS and stay under -10 dBFS. So we moved the peak limit from -10 to -3 dBFS. Nobody had tested the two numbers together.

## Mix the sound as written

Audio is `<audio>` tags in the page. Each tag has `src` or `data-synth`, `data-at`, and optional `data-gain` and `data-fade-out`. The mix is the sum of the tags at the gains the author wrote. A limiter at -1 dBTP only lowers peaks. It never raises a level. Normalising is opt in, through a `loudness` meta in LUFS.

We had a mixer that chose the level for the author. It had master targets and separate branches for films with a bed and films with only cues. A film with short cues and no bed could end up nearly silent. Another path could push a quiet film up toward a loud target. The author never saw the decision, and a tool that changes the result without a word is a tool you cannot debug. We deleted the mixer. With a plain sum, the number on the tag is the number in the film. The same thinking shapes our [AI agent guardrails](/blog/weaker-model), which advise far more than they refuse.

## Give each sound a default gain

A tag with no `data-gain` takes the default gain of its voice, from `DEFAULT_GAIN_DB` in `core/audio/kit.mjs`:

| Voice | Default gain |
| --- | --- |
| `tap` | -3 dB |
| `tick`, `air`, `swoosh-long`, `sub-thump` | -5 dB |
| `shimmer`, `glass` | -7 dB |

Cues stay within 4 dB of each other, and a test asserts it. A draft also warns, and never fails, when one cue peaks more than 6 dB above the median cue. The warning names the `data-gain` to change. `harness/media/page-audio.mjs` reads the tags, measures integrated loudness and true peak, and applies the limiter.

## Ban the synthetic music bed

A music bed is a sound that runs under the whole film. We used to synthesize one, and we removed it.

The first reason is a check we had. Our "no dead air" check looks for silence that runs too long. A bed fills the whole timeline, so the check could never fail on a film that had one. An agent told to make a check pass adds the easiest thing that does it. Motion has the same trick. A slow camera drift turned a live-hold check green on 18 of 36 films (see [reward hacking in AI agents](/blog/weaker-model)). A bed, a camera drift and a full-frame gradient are one kind of trick: a global move that turns a global check green.

The second reason is taste. A constant synthetic tone does not follow the picture. Cuts and actions pass over it and it stays the same. Next to a recorded effect, it sounds machine-made.

We chose to remove the voice, not to write a smarter check. A check that spots "a hum hiding silence" asks agents to hide the hum better. Removing the voice removes the trick. The change touched 44 files, added 133 lines and removed 376. A page that writes `data-synth="bed"` is now refused with the rule and the fix: use a real music file (`<audio loop src=...>`) or no bed.

The rule now has one owner, `taste/craft/sound.md`:

- Sound is small effects on actions: clicks, taps, pops, short whooshes, a success chime. Each sits on the frame of its action.
- Music comes only from a real track the user gives. A film with no track has no beat grid, and `vawe sound` says so.
- A film must still read with the sound off, because feeds autoplay muted.

Four of 24 audio films had shipped a constant synth bed when we counted. We grepped the page source of the films we had. Most are private, so you cannot reproduce the count from the public repo. We have no listening score for films after the ban. One person judged the sound by ear, and our own notes call the sound score of the judge unreliable.

## Measure your own film

Run this on any vawe page that has `<audio>` tags. The `colour-sting` example in the repo has six synth cues and no music file:

```bash
bin/vawe sound films/examples/colour-sting/page.html --waveform
```

We ran it and saw:

```
mix as written: -19.9 LUFS, -6.2 dBTP
```

The command also writes one PNG of the waveform with a tick for each cue. The audio tags are part of the [page contract](/blog/page-contract), and the [audio docs](/docs/audio) list every attribute. To cut to a real track, read [cut video to the beat with code](/blog/beat).

LUFS tells you that a film is loud enough. It cannot tell you that a cue lands on the action it belongs to.

## FAQ

**What LUFS should a video be?**
We aim near -20 LUFS integrated for short films and warn outside -24 to -16. Social platforms often target about -14 LUFS, so set a `loudness` meta if you publish there.

**What is the difference between LUFS and true peak?**
LUFS is the average loudness as an ear hears it. True peak is the highest point of the reconstructed waveform, and it is what causes clipping. Check both.

**How do I measure LUFS with ffmpeg?**
Run `ffmpeg -i film.mp4 -af ebur128=peak=true -f null -`. The summary at the end gives integrated loudness and true peak.

**Should generated video have background music?**
Only from a real track a person chose. Otherwise use small sound effects on the actions. A constant synthetic bed hides silence and does not follow the picture.

**Does vawe normalise loudness for me?**
Not by default. The mix is the sum of your tags, plus a limiter at -1 dBTP that only lowers peaks. Add a `loudness` meta to opt in.
