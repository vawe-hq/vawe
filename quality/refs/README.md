---
when: setting up or navigating a reference film for a recreation
answers: what lives in quality/refs/<name>/, which files are tracked, and which tools read them
group: process
---

# quality/refs: reference films

A reference is an in-house film a recreation must match. Its footage stays local; only the record of
what was measured is tracked.

```
quality/refs/<ref-name>/
  source.url    the reference's URL or a one-line note on where it came from
  beats.md      time windows and technique names, measured (see below)
  source.mp4    the film itself (gitignored)
  study/ drafts/ grid/   generated (gitignored)
```

Write `beats.md` from a measured cut list, never from a contact sheet:
`bin/vawe frame <ref-id> --cuts` finds the cuts and draws one strip per cut. Write one `## Beat <n>` heading
per window, each with a `- window: <start>-<end>s` line, and fill the label and the technique by looking
at the strips.

The loop that uses a reference is in `skills/vawe-reference/SKILL.md`: `bin/vawe see <ref.mp4> --spec` measures it,
`bin/vawe frame --vs` and `bin/vawe check coverage` check the rebuild against it, and
`bin/vawe see <render.mp4> --vs <ref-id>` lists the deltas worst first.
