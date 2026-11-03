---
title: "How to merge a git worktree into main"
description: "Merge a git worktree branch into main from the main checkout: fast-forward, rebase, squash, then remove the worktree. With the real errors and their fixes."
date: 2026-11-03
section: how-to
topic: how-to
tags: "git worktree, git merge, rebase, squash merge, vawe"
keywords: "how to merge git worktree to main, how to merge worktree into main, git worktree merge, git worktree remove, git worktree prune"
---

You cannot merge into `main` from inside a worktree, because `main` is already checked out in your main checkout. Commit in the worktree, go to the main checkout, and run `git merge <branch>`. Then remove the worktree and delete the branch.

```sh
cd ../app                  # the main checkout, on main
git merge --ff-only feature
git worktree remove ../app-feature
git branch -d feature
```

The rest of this post runs each step on a scratch repo, with the output git printed (git 2.54). Paths are shortened to `~/work`.

## Make the worktree and commit in it

A worktree is a second folder with its own branch, sharing one repository.

```sh
git worktree add ../app-feature -b feature
```

```text
Preparing worktree (new branch 'feature')
HEAD is now at 9cee3f7 first
```

Work and commit there as usual. `git worktree list` shows both folders:

```text
~/work/app          9cee3f7 [main]
~/work/app-feature  9cee3f7 [feature]
```

## The error: main is already checked out

The first thing most people try is `git checkout main` inside the worktree, then `git merge feature`. Git refuses:

```text
fatal: 'main' is already used by worktree at '~/work/app'
```

A branch can be checked out in one worktree at a time. So the merge has to run where `main` lives. Either `cd` to the main checkout, or stay in the worktree and point git at it:

```sh
git -C ~/work/app merge --ff-only feature
```

Both do the same thing. `-C` is useful in a script, because the shell stays in the worktree.

## Fast-forward merge

If `main` has not moved since you branched, a plain merge fast-forwards:

```sh
git merge feature
```

```text
Updating 9cee3f7..66fa56a
Fast-forward
 a.txt | 1 +
 1 file changed, 1 insertion(+)
```

Use `git merge --ff-only feature` to make that a rule. It never creates a merge commit, and it stops if it cannot fast-forward. Run it again after the merge and you get `Already up to date.`

## When main has moved: rebase first

If someone else committed to `main` after you branched, `--ff-only` stops:

```text
hint: Diverging branches can't be fast-forwarded, you need to either:
hint:
hint: 	git merge --no-ff
hint:
hint: or:
hint:
hint: 	git rebase
fatal: Not possible to fast-forward, aborting.
```

Rebase the branch in the worktree, where `feature` is checked out. Then merge from the main checkout:

```sh
cd ../app-feature && git rebase main
cd ../app && git merge --ff-only feature
```

```text
Successfully rebased and updated refs/heads/f2.
Updating deefb68..9681f96
Fast-forward
```

The history stays a straight line. If you want a merge commit instead, use `git merge --no-ff feature`.

## Squash many commits into one

If the branch has "wip" commits you do not want in `main`:

```sh
git merge --squash feature
git commit -m "add s1 and s2"
```

`--squash` stages the changes and does not commit, which is why the second line is needed. Git prints `Squash commit -- not updating HEAD`.

## Remove the worktree and the branch

```sh
git worktree remove ../app-feature
git branch -d feature
```

After a squash, `git branch -d` refuses, because the original commits are not in `main`:

```text
error: the branch 'f3' is not fully merged
hint: If you are sure you want to delete it, run 'git branch -D f3'
```

The work is in `main` as the squash commit, so `git branch -D` is safe here. Check `git log main` first.

If you delete the branch before removing the worktree, git says `cannot delete branch 'f3' used by worktree`. Remove the worktree first.

## A dirty worktree will not be removed

```text
fatal: '../app-f4' contains modified or untracked files, use --force to delete it
```

Commit or move the files you want. Use `git worktree remove --force ../app-f4` only if you are sure they are scratch files. It deletes them.

## You deleted the folder with rm

If you removed the folder by hand, git still lists it:

```text
~/work/app-gone  c5a2692 [gone] prunable
```

`git worktree prune -v` cleans the record:

```text
Removing worktrees/app-gone: gitdir file points to non-existent location
```

## How vawe does it

vawe's agents work this way: one worktree per task, on a topic branch. The branch reaches `main` by a rebase and a push, not by a merge commit. `bin/vawe-dev land` runs the steps: fetch, rebase onto `origin/main` (it stops on a conflict), scan the range for files over 5 MB, run the tests, and push. The `.githooks/pre-push` hook then checks the pushed range. The command is specific to our repo, but the steps are the same ones as above.
