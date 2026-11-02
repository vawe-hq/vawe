# site/ : read DESIGN.md before you change a pixel

`IDENTITY.md` holds the brief the design answers to: who it is for, the studio look, and the skills
that shaped it. Read it once; read `DESIGN.md` every time.

**[`DESIGN.md`](DESIGN.md) is the contract for this directory.** It was extracted from the shipped
CSS, not written as an aspiration, so it describes what the site IS. Read it first, every time, and
if you change the system, change it there too.

The root `CLAUDE.md` governs the video engine. It has nothing to say about this Next app, and the
film-craft docs (`guides/README.md`) deliberately do not cover `DESIGN.md`, because a token table
for a marketing site answers none of their questions. This file is how you find it instead.

## The five rules a contributor breaks first

1. **z-index is a closed set.** `--z-under · --z-base · --z-raise · --z-badge · --z-sticky · --z-nav
   · --z-skip`. Never write a number. If `--z-raise` is not enough you need your own stacking
   context, not a bigger number.
2. **Colour has two voices, each with one meaning.** The accent blue (`--accent`) means *you can act
   on it* or *this is live*, and is used rarely. A lane colour (`--lane-*`) means *this layer type*, as in the studio
   timeline, and always sits next to a label. Nothing else gets colour. Text on the blue is
   `--accent-ink` (black, 6.6:1); white on it measures 3.2:1. Never tint the accent for a secondary
   state: blue on its own tint measured 4.3:1 on the playground rail. Use `--ink` on `--raised`.
3. **A rule reaches `globals.css` only when two routes need it.** One consumer keeps it in its own
   stylesheet. That rule is why a consolidation pass could delete 221 dead lines instead of 400.
4. **Pick a breakpoint from {640, 760, 900}** unless you have a measured reason. The set has already
   drifted once: 900 and 860 both ship and are the same breakpoint written twice.
5. **Record what shaped a surface, in DESIGN.md's provenance table, while you still know.** One line,
   naming the source precisely enough to re-fetch and saying what you REJECTED from it. Three surfaces
   already read UNRECORDED because nobody wrote it down and the session ended. Tokens survive in the
   CSS; the reasoning only survives if you type it.

## Where the craft bar was

`app/arsenal/` set it: hairlines for structure, ONE elevation step and only on hover, mono for
anything literal and sans for prose. The route left with the JSON engine; read `arsenal.css` at the
tag `arsenal-final` and match that register.

## Routes and the sitemap

`site/lib/site-pages.json` lists every route; the footer nav and `app/sitemap.ts` both read it, and
`bin/vawe-dev check seo-surface` fails when it and `app/` disagree. Edit it by hand when you add a page.

## Look at it before you say it is done

Do not write a screenshot or link-check script: the verbs do it from the repo root.
`bin/vawe shot /,/blog --full` writes each route at 1440 and 390 (lazy images loaded, the dev server
started and stopped for you) and says which route has page errors, failed requests or sideways overflow.
`bin/vawe-dev check links` crawls the site and lists broken links, redirects and dead anchors; `--base https://vawe.dev`
checks the live site. `node scripts/site/typography-audit.mjs` measures the type rules.

## Known gaps, so you do not rediscover them

- **Scales: every route uses them (2026-10-14).** Type, space, radius, motion and state tokens are in
  `globals.css` and `DESIGN.md`. The deliberate literals are listed in `DESIGN.md` "Migration to the scales".
  A new route takes tokens from the start; a `px` size, a `.15s ease` or a literal `2px solid var(--accent)`
  in a new rule is a defect.
- **Black only.** The site is pure black by decision (`IDENTITY.md`), with
  `color-scheme: dark`. There is no light mode to keep in sync.
