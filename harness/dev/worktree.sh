#!/usr/bin/env bash
# harness/dev/worktree.sh: make a git worktree usable by an agent, in about a second.
#
#   harness/dev/worktree.sh add <name> [scope-glob ...]  → .claude/worktrees/<name>, ready to run gates
#   harness/dev/worktree.sh rm  <name>
#
# THE SCOPE GLOBS ARE OPTIONAL, and record what harness/author/critics.mjs's DECIDERS already carry
# for deciders: the files this worktree is TOLD it owns, so worktree-status.mjs can show who owns what,
# and a second worktree started with an overlapping scope is warned (never blocked) at creation time.
# See harness/lib/worktree-claims.mjs. Leaving them off costs nothing beyond today's status quo.
# WHY THIS EXISTS. `git worktree add` checks out tracked files only. This repo keeps 444M of
# node_modules, an 11M bin/, and 108 of its 149 scenes out of git, so a bare worktree cannot run a
# single gate, and fails QUIETLY: `layer-props` walks 41 scenes instead of 149 and prints a green tick.
# Measured: the worktree itself takes 0.70s and 127M. The naive fix, two npm installs, takes minutes and
# is why people abandon worktrees (towardsdatascience.com/ai-agents-need-their-own-desk...).
#
# WHAT IS SHARED AND WHAT IS COPIED, because the distinction is the whole design:
#   node_modules  SYMLINK, read-only in practice. pnpm's own guidance warns against a shared store for
#                 mutually untrusted agents, and the corruption case is CONCURRENT INSTALLS, so no
#                 agent may run npm install in a worktree. If you need to, make a real checkout.
#   scenes        COPIED. Two agents editing one scene through a symlink is the shared-tree collision
#                 this whole mechanism exists to prevent.
#   bin/vawe      SYMLINK. Built once, read many.
set -euo pipefail
# The main checkout, per GIT'S OWN definition (first entry of `worktree list`), not the path this
# script happens to live at. `harness/dev/worktree.sh` is a TRACKED file, so it is present, unchanged,
# in every worktree too; resolving ROOT from BASH_SOURCE's relative path silently picks whichever
# worktree the caller's cwd was in, and this script would nest a new worktree inside that one instead
# of the real .claude/worktrees/. sync-worktree.mjs uses the same `worktree list` lookup, so this is
# one definition of "main", not a second one growing alongside it.
ROOT="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
cmd="${1:-}"; name="${2:-}"
[ -n "$name" ] || { echo "usage: worktree.sh add|rm <name> [scope-glob ...]" >&2; exit 2; }
WT="$ROOT/.claude/worktrees/$name"
shift 2  # remaining args, if any, are declared scope globs (add only)

if [ "$cmd" = "rm" ]; then
  git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true
  node "$ROOT/harness/dev/worktree-claim.mjs" rm "$name" 2>/dev/null || true
  echo "✓ removed $name"; exit 0
fi
[ "$cmd" = "add" ] || { echo "usage: worktree.sh add|rm <name>" >&2; exit 2; }

# BRANCH FROM origin/main, NOT FROM $ROOT's HEAD. $ROOT is git's main checkout, and on a machine
# where the work happens in a linked worktree it can sit detached on a commit hundreds behind: it did,
# at 79adcd80, 220 commits back. `worktree add ... HEAD` reads THAT HEAD, so every agent handed a fresh
# worktree started on stale code and could not see today's work. Two agents in one session rebuilt
# their worktrees by hand after hitting it. origin/main is the branch this repo pushes to directly, so
# it is the honest base; ROOT's HEAD is only a fallback for a clone with no remote, and the base is
# printed either way so a wrong one is visible rather than silent.
BASE="$(git -C "$ROOT" rev-parse --verify -q origin/main || git -C "$ROOT" rev-parse HEAD)"
echo "  base: $(git -C "$ROOT" log --oneline -1 "$BASE")"
git -C "$ROOT" worktree add -q -b "wt-$name" "$WT" "$BASE"
# shared, read-only
for d in node_modules; do
  [ -d "$ROOT/$d" ] && ln -sfn "$ROOT/$d" "$WT/$d"
done
mkdir -p "$WT/bin" && ln -sf "$ROOT/bin/vawe" "$WT/bin/vawe" 2>/dev/null || true
ln -sfn "$ROOT/.vawe-data" "$WT/.vawe-data" 2>/dev/null || true
# COPIED, because they get edited, AND DRIVEN FROM .worktreeinclude, not from a second list.
#
# This loop used to be its own hand-written list: assets/fonts/local, films/scene/*.json, and each
# brand's components/scenes/photos. `.worktreeinclude` meanwhile asked for `assets/fonts/*.woff2`,
# `assets/brands/**` and `assets/cutouts/**` as well, with a comment on each explaining which silent
# failure it prevents. The script did not implement its own manifest, so every worktree made here was
# missing the vendored webfonts and every brand IMAGE. Measured: `snap-scenes` in a fresh worktree gave
# 16 identical · 61 changed · 29 errored against main's 106 identical, every one of those from a
# fallback font or an image that was never there, and none of them a real defect.
#
# A hand-kept scope drifting from the vocabulary it
# claims to cover. A manifest with two implementations has no implementation.
#
# THE COPY ITSELF IS NOW `sync-worktree.mjs`, not a second copy loop. Main can keep moving after this
# worktree is created (an owner edits a film while an agent's worktree sits open for hours), and
# nothing here would notice; `sync-worktree.mjs` is the one place that both makes the first copy and
# can safely re-run later to catch a worktree up, because it is the one place that keeps the
# hash manifest a re-run needs to tell "main moved on" from "I edited this" apart.
if [ ! -f "$ROOT/.worktreeinclude" ]; then
  echo "✗ .worktreeinclude is missing: a worktree built without it cannot render. Aborting." >&2
  exit 1
fi
# Run the sync script from the NEW worktree, not from $ROOT. $ROOT's TRACKED files are whatever its
# HEAD holds, and a stale detached HEAD does not have this script at all: every `worktree.sh add` in
# one session died here with MODULE_NOT_FOUND after the worktree was already made, so each agent was
# handed a worktree with no library and had to copy it in by hand. The new worktree is checked out at
# $BASE, so it always carries the current script.
node "$WT/harness/dev/sync-worktree.mjs" "$WT"

# Prove it is usable rather than assuming. A worktree that cannot see the library is worse than none,
# because every gate in it reports a confident green.
#
# Checked PER MANIFEST PATTERN, not per hand-picked item. The old check counted scenes only, so the
# missing webfonts and brand images it was also supposed to carry sailed past a green tick for months.
# Counting whatever `.worktreeinclude` asks for means a line added there is verified the day it is
# added, and this check cannot fall behind the manifest the way the copy loop did.
fail=0
while IFS= read -r pat; do
  case "$pat" in ''|'#'*) continue ;; esac
  c_main=$(cd "$ROOT" && eval ls -d $pat 2>/dev/null | wc -l | tr -d ' ')
  c_wt=$(cd "$WT" && eval ls -d $pat 2>/dev/null | wc -l | tr -d ' ')
  printf '  %-34s %s of %s\n' "$pat" "$c_wt" "$c_main"
  [ "$c_wt" = "$c_main" ] || { echo "✗ $pat, $c_wt of $c_main arrived. A worktree missing this renders a substitute and every gate in it reports a confident green." >&2; fail=1; }
done < "$ROOT/.worktreeinclude"
echo "✓ $WT  (branch wt-$name)   node_modules: shared   bin/vawe: shared"
[ "$fail" = 0 ] || { echo "✗ refusing to hand over an incomplete worktree." >&2; exit 1; }

# Record the claim LAST, once the worktree is proven usable. Scopes are whatever globs the caller
# passed after <name>; none is fine, it just carries no overlap check (see the header note). Warns
# on overlap with another LIVE worktree's declared scope, never blocks: guides's
# observability plan, Task 2.
if [ -f "$WT/harness/dev/worktree-claim.mjs" ]; then
  node "$WT/harness/dev/worktree-claim.mjs" add "$name" "wt-$name" "$@"
fi
