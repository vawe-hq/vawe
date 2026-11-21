#!/bin/sh
# Link the main checkout's shared stores into a linked worktree: node_modules and
# .vawe-data. Read-only links, never copies (a concurrent install through two worktrees
# corrupts the store). Silent and near-instant when there is nothing to do. The Claude Code worktree
# tool does not fire post-checkout, so pre-commit calls this too.
set -u
WT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
MAIN="$(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')"
[ -n "$MAIN" ] && [ -n "$WT" ] || exit 0
[ "$WT" = "$MAIN" ] && exit 0
for d in node_modules .vawe-data; do
  if [ ! -e "$WT/$d" ] && [ ! -L "$WT/$d" ] && [ -d "$MAIN/$d" ]; then
    ln -sfn "$MAIN/$d" "$WT/$d"
  fi
done
exit 0
