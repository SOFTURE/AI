---
change_id: release-version-dev-ranges-982
verdict: approved
---

# Implementation review: release-version-dev-ranges-982

- Plan followed: both phases, commits c6be406 and c4f5f4c; no scope beyond `scripts/release/` and its tests.
- `checkInternalRanges` covers `devDependencies`; the shared rule also gates `release:pack`. The repo test "accepts
  every internal range of every workspace" keeps master green against it; it is green on 1f92ca9.
- `findRegistryWorkspaceCopies` matches on the last `node_modules/` segment, so nested chains
  (`a/node_modules/@softure-ai/x/node_modules/@softure-ai/y`) count too; non-workspace packages are ignored; a
  non-object entry is reported (safe side).
- `version.mjs`: the guard runs after `npm version` and before any file of its own is written, so
  `git checkout -- .` restores everything tracked; the message names every entry and `npm ci`. A corrupt lockfile
  makes `JSON.parse` throw: a bug-level failure, left to propagate (AGENTS.md: exceptions are for bugs).
- Verified end to end in a scratch worktree (plan.md, Verification): the issue's first case is refused before any
  change; with the range check disabled, the guard catches the registry copies and leaves a clean tree.
- Gates: typecheck and lint (pre-commit), `tests/repo` 16 files green (deploy-workflows needed `ssh-keygen`, an
  environment tool, not this change). Language gate green. Approved.
