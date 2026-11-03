# Blog posts

One Markdown file per post in this folder. `lib/blog.ts` reads them; this file is not a post.

## Schedule a post

Set `date` to the day the post goes live, as `YYYY-MM-DD` in UTC. Merge and deploy it any time before.

- Until that day the post is not listed on `/blog`, in a category, in the RSS feed, in the sitemap or in "Read next", and `/blog/<slug>` returns 404.
- From that day (UTC) it appears everywhere. The index, the posts, the feed and the sitemap regenerate every hour, so it goes live within the hour with no redeploy.
- Do not backdate. The date is the day the post is published. `updated` is the day of a later real edit. The post page shows it as "Updated <Month Year>" only when it is later than `date`, and it feeds `dateModified` and the sitemap `lastmod`. No page shows the publish day.
- `next dev` and `BLOG_DRAFTS=1` show future-dated posts, so you can preview one.

## Order

Newest `date` first. Posts that share a date sort by the time their file was first committed, later first (`lib/blog-added.json`, written by `scripts/site/blog-added.mjs` in `prebuild`). Commit the new post, run `npm run prebuild` in `site/` and commit the JSON change. The times never show.

## Featured

Add `featured: true` to up to three posts. `featuredOrder: 1` puts a post first. The first featured post is the large card, the next two are medium cards, and any further featured post is a normal card. The band shows while "All" is chosen.

## Footer guides

Add `nav: <short label>` (at most 24 characters) to put a post in the "Guides" column of the footer on every page. At most nine posts set it; the build fails on a tenth. Give it to the how-to posts that answer a search, since a link from every page is how Google finds a post worth crawling.

## Sections

`section` is one of `how-to`, `rendering`, `agents`, `motion-sound` (`SECTIONS` in `lib/blog.ts`, `[data-s]` in `blog.css`).

## Share card

`topic` picks the scene of the post's share card: one of `TOPICS` in `lib/blog-front-matter.mjs` (`agents`, `determinism`, `rendering`, `audio`, `motion`, `watching`, `how-to`, `site`), each a scene in `assets/brand-art/cards.js`. Run `node scripts/site/og-cards.mjs` and commit `site/public/og/` (the card and `stamp.json`); the post's `opengraph-image` serves that file, and `bin/vawe-dev check seo-surface` fails without it.

## Agents

`/llms.txt` lists every live post and `/blog/<slug>.md` serves its Markdown. Both follow the `date` rule above, with no deploy. A removed post needs a line in `BLOG_MOVED` in `lib/redirects.mjs`.
