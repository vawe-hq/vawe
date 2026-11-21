---
when: writing or changing repo maintenance tooling: a brand-capture script
answers: "what scripts/ is: brand/ (capture a site into a kit: palette, sections, photos)"
group: process
---

# scripts/

Repo maintenance, distinct from `generators/` (bakes standing assets) and `harness/` (film-authoring
tools and hooks).

- `brand/`: reflects a website into `assets/brands/<name>/`. `node scripts/brand/kit.mjs <url> <name>`
  runs the steps in one go and writes `kit.json` (palette, fonts, favicon, section captures).
  The steps run alone: `sections.mjs`, `palette.mjs`, `photos.mjs`, `localize-assets.mjs`.
The marketing site and its build helpers (`scripts/site/`) live in vawe-hq/vawe-site.
