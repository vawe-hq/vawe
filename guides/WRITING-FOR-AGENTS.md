---
when: "you are writing or editing AGENTS.md, a skills/*/SKILL.md, or a brief an agent will read, and want the rule to survive truncation"
answers: "six patterns that keep a rule readable by an agent, and the frontmatter and size contract a SKILL.md must meet"
group: crosscutting
---

# Writing rules an agent can actually read

Six patterns, read off real files here. Apply them to AGENTS.md, a skill or a brief. This page owns
structure, not voice: for tone, word choice and the em-dash ban see the house writing rules.

Why: a rule to open the frames before trusting a verdict once sat after the storyboard it governed. A
terminal filter cuts what comes last, so the one line that made the judge's question answerable reached
nobody. Moving it above the storyboard fixed it. That is pattern 6.

1. **Rule, then reason, then mechanism.** What to do first, why second, which file or command third. A
   reader who stops after the first sentence still knows the rule.
2. **One rule is one to three sentences, then stop.** A fact that needs a fourth sentence needs a second
   rule.
3. **A refusal states the block once and moves to the alternative.** Name what is blocked and the way
   out. Do not re-argue the constraint.
4. **Capability first, error states last.** Say what the mechanism does before how it fails.
5. **Every scope limit carries its examples inline.** "Never `git add -A`" is a vibe. "Never `git add -A`,
   `git add .`, `git stash`" is a boundary an agent can check.
6. **An instruction comes before the material it governs.** Truncation drops the end first.

A rule over about 500 characters is too long: `bin/vawe-dev check rule-length` ratchets the count, and
`node quality/gates/rule-length.mjs --list` prints the worklist.

## SKILL.md contract

Anthropic's published contract for skills
(https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):

- `name`: `^[a-z0-9-]+$`, at most 64 characters, matches its directory, never contains "claude" or
  "anthropic".
- `description` is the retrieval field, loaded for every skill at startup. Write it in the third person
  ("you" can cause discovery problems). State what the skill does and when to use it, under 1,024
  characters, with no XML tag.
- The body stays under 500 lines and about 5,000 tokens (words x 1.33).
- Frontmatter opens at byte 0 (`---` on line 1). A generated body is not a skill: if a body has to be
  generated, it wants to be a lookup.
