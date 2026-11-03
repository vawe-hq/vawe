# site/

The vawe.dev marketing site: a Next.js app with its own design system, separate from the engine and
from the docs app (`vawe-hq/vawe-docs`).

Read by: a human or agent working on the marketing site. Not read by the render engine.

The one doc: `site/DESIGN.md` (the contract, extracted from shipped CSS), entered through
`site/CLAUDE.md`. No repo-level gate covers this folder; `npm run build` inside it is the check.

Look first: `site/CLAUDE.md`, then `site/DESIGN.md`.

Bot log: `site/lib/bots.ts` writes one JSON line per AI or search-engine request to
`$BOT_LOG_DIR/bots-YYYY-MM-DD.jsonl`; nothing is logged when `BOT_LOG_DIR` is unset. The Dockerfile sets
`BOT_LOG_DIR=/data/bots` and declares that path a volume: you must mount the named volume `-v vawe-bots:/data/bots`; without it every redeploy gets a fresh anonymous volume and the log is lost (Coolify:
persistent storage with destination `/data/bots`). Read it with `bin/vawe-dev bots <dir> [--days n]`.
Set `BOT_LOG_TOKEN` to serve the log at `GET /api/bot-log?days=n` (default 7, max 90) with
`Authorization: Bearer <token>`; the route answers 404 when the token is unset or wrong. `bin/vawe-dev seo` reads it
with `VAWE_BOT_LOG_TOKEN`.
