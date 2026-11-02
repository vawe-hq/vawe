# The marketing site. Build context is the REPO ROOT, not site/. The faces, which cannot be
# committed, are copied into site/public at build time by scripts/site/vendor-assets.mjs.
#
#   docker build -t vawe-site .
#   docker run -p 3000:3000 vawe-site
FROM node:22-alpine AS builder
# The workdir is /src, not /repo, on purpose. The deploy host held a BuildKit cache entry for the
# `WORKDIR /repo` layer whose backing overlay directory had been pruned away, so committing ANY child
# layer onto it failed with "failed to stat active key during commit". Renaming the workdir re-keys the
# parent. `docker builder prune -af` on the host is the actual cure.
WORKDIR /src

COPY scripts ./scripts
# generators/ bakes the standing assets (fonts here); the RUN below needs it in the image
COPY generators ./generators
# scripts/site/moves.mjs and easing.mjs import the motion library at build time
COPY core ./core
# The rule this encodes: only COPY a path git actually carries. A COPY of a gitignored directory is a
# hard failure at build time, not a missing file.

# Font binaries are deliberately NOT committed (redistribution), so a clean checkout has none, and
# the social cards (site/app/components/ogCard.tsx) render with them.
# fonts.mjs uses only node builtins, hence no install needed here.
#
# It reads exactly two repo paths: assets/fonts (which it writes) and this lock, which it refuses to
# run without ("Every face would read as unlocked"). The lock moved to harness/media/ in the layout
# pass and no COPY followed it, so the build died here. docker-check reads COPY lines and cannot see
# what a RUN step opens, which is why this one arrived as a failed deploy rather than a failed gate.
COPY harness/media/fonts.lock.json ./harness/media/fonts.lock.json
RUN node generators/media/fonts.mjs
# scripts/site/moves.mjs (the site prebuild) imports the clip hash owner; a missing import kills the
# prebuild before its "prompts/moves is not here" early exit runs.
COPY harness/lib/clip-hash.mjs ./harness/lib/clip-hash.mjs

# --- the site ---
# The REPO ROOT package.json, because site/lib/schema.ts imports `../../package.json` to read the
# engine's real description, version, licence and repo URL into the SoftwareApplication JSON-LD
# rather than retyping them. From /src/site/lib that resolves to /src/package.json, which was not in
# the image, so the site built clean on every laptop and died here with "Module not found: Can't
# resolve '../../package.json'". The same class as the assets/plinth line below: a path that exists
# in a checkout is not a path that exists in a build context.
#
# Copied at /src, ABOVE the site's own npm ci, so it is a layer that only busts when the engine's
# version or description actually changes. docker-check reads COPY lines and cannot see what a JS
# import resolves to, which is why this arrived as a failed deploy rather than a failed gate.
COPY package.json ./package.json
COPY site/package.json site/package-lock.json ./site/
WORKDIR /src/site
RUN npm ci

COPY site/ ./
# `prebuild` runs ../scripts/site/vendor-assets.mjs, which copies the faces into public/assets/
# BUILD TO `.next`, DO NOT RENAME AFTERWARDS. `site/package.json`'s build script pins
# NEXT_DIST_DIR=.next-build so a running `next dev` and a `next build` do not fight over `.next`
# locally. Nothing runs `next dev` in this image, so the pin has no job here and two attempts to
# accommodate it both shipped broken.
#
# The first attempt left the COPYs naming `.next` while the build wrote `.next-build`: six production
# deploys failed on `failed to calculate checksum of ref ... not found`, on a layer BuildKit had also
# printed as CACHED, which reads exactly like a poisoned cache and is really a path never written.
#
# The second renamed the directory after the build. That deployed GREEN and served every stylesheet as
# a 404, because `next build --output standalone` BAKES the dist dir into its own server:
# `.next-build/standalone/server.js` carries `distDir: "./.next-build"` and the standalone tree nests a
# second `.next-build/` inside itself. Renaming the outer directory moves nothing the server looks for.
#
# So run the prebuild explicitly and then a plain `next build`, which takes the `.next` default from
# next.config.mjs. `npm run build` would re-apply the pin. The guard is what stops a third attempt:
# it names the cause instead of letting the failure arrive as a 404 on a page that returned 200.
# Next bakes rewrites into the build, so the docs origin (site/lib/docs-origin.mjs) must be here at build time.
ARG DOCS_ORIGIN=
ENV DOCS_ORIGIN=$DOCS_ORIGIN
RUN test -n "$DOCS_ORIGIN" || { echo "✗ DOCS_ORIGIN is empty. Pass --build-arg DOCS_ORIGIN=<docs app origin>; without it the build bakes the dev default and /docs fails in production."; exit 1; }
RUN npm run prebuild && npx next build
RUN test -d .next/static && test -d .next/standalone || { echo "✗ the site build wrote no .next/static or .next/standalone. Something re-applied NEXT_DIST_DIR; the runner COPYs below name .next."; exit 1; }

# --- runtime: standalone server only, no dev deps ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# The middleware and llms.txt read it at run time; it must equal the build value.
ARG DOCS_ORIGIN=
ENV DOCS_ORIGIN=$DOCS_ORIGIN

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# The server needs only node; the npm bundled in the base image carried 10 HIGH CVEs (Trivy, 2026-11-03).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# standalone traces the server; public/ and .next/static are NOT included by it — copy explicitly.
# the site sets outputFileTracingRoot to its own dir, so its standalone root holds server.js
COPY --from=builder --chown=nextjs:nodejs /src/site/.next/standalone ./site
COPY --from=builder --chown=nextjs:nodejs /src/site/.next/static ./site/.next/static
COPY --from=builder --chown=nextjs:nodejs /src/site/public ./site/public

COPY --chown=nextjs:nodejs site/docker-start.sh ./
RUN chmod +x docker-start.sh

# Bot log (site/lib/bots.ts): one JSON line per AI or search-engine request. Mount a volume here,
# e.g. `-v vawe-bots:/data/bots` (Coolify: persistent storage, destination /data/bots). Unset
# BOT_LOG_DIR to log nothing.
RUN mkdir -p /data/bots && chown nextjs:nodejs /data/bots
ENV BOT_LOG_DIR=/data/bots
VOLUME /data/bots

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO /dev/null http://127.0.0.1:3000/robots.txt || exit 1
CMD ["./docker-start.sh"]
