---
when: adding, changing or looking up a gate, a ratchet baseline or a reference record
answers: "what quality/ is: the gate scripts (gates/), their ratchet baselines (baselines/) and the reference records (refs/)"
group: engine
---

# quality/

`gates/` holds the checkers. `bin/vawe check` lists them and `bin/vawe check <name> [args]` runs one:
`page-check` and `anim-traps` (a page), `doc-refs` (every path a doc names must exist), `code-quality`,
`skill-reach`, `rule-length`, `threshold-provenance` and a few more. `judge.mjs` and `rubric.mjs` are not gates: `bin/vawe judge` runs them. `bin/vawe frame --vs` runs
`harness/media/compare-frames.mjs`.

`baselines/` holds the ratchet files. A ratchet gate compares today's count to its file, so a metric can
only get better. Fix something, run the gate with `--write`, and the line drops for good.

`refs/` holds the reference records (`quality/refs/README.md`).

Each gate script carries a header comment that says why it exists. Read the one you change before you
write to it. The pre-commit hook runs `doc-refs` on staged docs.
