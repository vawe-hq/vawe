---
when: you want to change this repo rather than use it
answers: the licence you are contributing under, how to run the suite, and the four things this repo pushes back on
group: project
---

# Contributing to Vawe

Thanks for looking. This file is short because the repo explains itself: `AGENTS.md` is the authoring
doctrine (tool-neutral; `CLAUDE.md` is a shim that loads it) and `guides/README.md` maps the other documents.

## Licence, first, so nobody wastes an afternoon

Vawe is licensed under the **Apache License 2.0**. Use it, change it, ship it, commercially or not:
keep the notices, and the patent grant comes with it. `LICENSE` is the full text and `NOTICE` carries
the third-party attribution a redistribution must keep. Contributions are accepted under the same
licence.

## Getting it running

```bash
npm install
bin/vawe new hello                       # films/hello/page.html and brief.md
bin/vawe dev films/hello/page.html       # -> out/hello-draft.mp4
bin/vawe --help                          # every verb; bin/vawe <verb> --help lists its flags
```

## The one rule that explains most of the codebase

**A frame is a pure function of the seek time `t`.** The same `t` must produce the same pixels
regardless of what was rendered before it, because frames are captured across parallel workers.
Anything that breaks that is a bug even if it looks right. `tests/media/render-page-determinism.test.mjs`
checks it.

## Before you open a PR

```bash
bin/vawe-dev e2e                       # page tests plus a draft of every film, about 4 s
bin/vawe-dev test                      # the whole test suite (tests/**/*.test.mjs)
bin/vawe-dev check code-quality            # nothing got more tangled
```

`make install-hooks` turns on the pre-commit hook (no em dash, `node --check`, doc references) and the
pre-push hook (the same, plus the site gate, unit tests and e2e that the changed paths can affect; it
prints which it chose and why, and a path it does not know runs everything).

The last check is a **ratchet, not a threshold**. The repo has known complexity debt recorded in
`quality/baselines/code-quality-baseline.json`; the gate fails only if your change makes a file worse than that
line. Fixing something and running `bin/vawe-dev check code-quality --write` lowers the line permanently.

If you touch a **gate**, run it over every film before and after and diff the results. The
only acceptable outcomes are "no film changed" or "these N changed, and here is why each was a false
positive". One film going from pass to fail is a regression until proven otherwise. This rule exists
because a gate that measures the wrong thing does not merely miss defects, it manufactures them, and
the author pays by deforming good work until a number moves.

## Things this repo will push back on

- **A new gate.** Fix it at the write site if you can. A gate is for what is only knowable after a
  render, across the whole library, or by a human. `AGENTS.md` has the full test, and two gates have
  been deleted here for measuring the wrong thing.
- **A second way to say something the code can already say.** Two mechanisms for one fact is the drift
  that produces most of the bugs here.
- **Sugar that silently does nothing.** An input the engine accepts and then ignores must either work
  or fail loudly by name.
- **Em dashes in on-screen text.** The validator rejects them.

## Assets

Never commit a font, photo or brand mark without a licence and a source. `NOTICE` records every
one, and photos are fetched on demand rather than committed. No recreation of another company's
marketing page ships from here, in any form.

## Reporting something

Open an issue with the `page.html` that reproduces it, or the exact command and its output. If you
believe an asset is misattributed, say so and it will be removed.
