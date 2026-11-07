# edit-reel: brief

Template: prompts/edit-from-clips.md. The footage is four of our own rendered clips from site/public/moves, copied plain into footage/ (no proxy step).

## Task

- what: a 10 s reel of four motion clips, cut with a title card, one caption per clip, one crossfade and three hard cuts
- message: four moves, one idea each
- length: 10 s, 16:9

## Cut list

| world | clip | in | out | rate | why |
|---|---|---|---|---|---|
| s2 | ai-stream-response | 0 | 2.13 | 1 | opens on the streaming reply: the most readable motion first |
| s3 | approval-gate | 0 | 2.13 | 1 | crossfade: the reply waits, a person decides |
| s4 | agent-progress | 0 | 2.13 | 1 | hard cut: the work resumes |
| s5 | anchor-cycle | 0 | 2.13 | 1 | hard cut: the quiet closing clip |

message: four moves, one idea each

## Deliver

- out/edit-reel.mp4 from `bin/vawe ship`, after the clip seek is in the engine.
