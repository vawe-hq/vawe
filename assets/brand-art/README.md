# Brand art

Two-ink screenprint scenes painted in canvas 2D (`art.js`, seeded, so each render is the same image)
with the copy and layout in `page.js`. One page per format: `banner.html` (2:1), `og.html` (1200:630),
`post.html` (16:9), `square.html` (1:1). Pick the image with the query: `scene`, `ink` (`a` blue print,
`b` night print) and `copy` (the keys of `COPY` in `page.js`).

Each repo gets its own scene, never one used for another repo:

| Scene | What it shows |
|---|---|
| `lanes` | timeline towers along a road to the star (vawe) |
| `pages` | page stacks seen from above, the film frame glowing below |
| `strip` | a page that runs on as a filmstrip under frame gates (the org) |
| `stair` | six skill cards hung as a stair that climbs to the star (skills) |
| `search` | a night city of page towers; searchlights sweep, one lands on the cited page (AI search visibility) |
| `catalog` | an endless card-catalogue wall, one drawer open, the figure brings a card (skills directories) |
| `cinema` | a projector beam through haze onto a huge screen with the star in the film (agent video) |

Render from the repo root with `bin/vawe frame assets/brand-art/<format>.html --at 0 --param scene=<s> --param ink=<i> --param copy=<c>`.
Add `--size 1280x640` to a banner for a GitHub social preview.

| File | Scene, ink, copy |
|---|---|
| `assets/banner.png` (vawe README) | lanes, blue print, `concept` |
| `vawe-hq/.github` `profile/banner.png` | strip, blue print, `org` |
| `.github/skills-repo/assets/banner.png` (vawe-hq/skills) | stair, night print, `stair` |
| `vawe-hq/awesome-ai-search-visibility` `assets/banner.png` | search, night print, `search` |
| `vawe-hq/awesome-agent-skills-directories` `assets/banner.png` | catalog, blue print, `catalog` |
| `vawe-hq/awesome-agent-video` `assets/banner.png` | cinema, night print, `cinema` |
| `site/app/opengraph-image.png` (vawe.dev default card) | strip, night print |
| `site/public/assets/og.png` (docs card) | strip, blue print |

## Share cards and loops (vawe.dev)

`cards.js` gives each main page of vawe.dev a scene, ink, composition, copy and loop motion (`PAGES`), and each
blog topic a scene and a `vary()` that a seed from the post's slug draws a composition from (`TOPICS`; a post names
its topic in its `topic` front matter). `card.html` paints a still (`?route=/easing`, or `?post=<slug>&title=&section=&topic=`),
`loop.html` a seamless 5 s loop of a page. `node scripts/site/og-cards.mjs` writes the cards to `site/public/og/`;
`--loops` also renders each page's loop with `bin/vawe dev --small` (960x504, 30 fps). A loop key is absent from a
still, and every scene draws a still exactly as before the loop keys existed.

