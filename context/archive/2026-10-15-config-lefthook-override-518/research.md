---
change_id: config-lefthook-override-518
---

# Research: config-lefthook-override-518

Sources: `tools/config/presets/lefthook.yml`, `tools/config/README.md` (git hooks), `tools/config/tests/presets.test.ts`,
lefthook 2.1.16 (`node_modules/.bin/lefthook dump` in a scratch git repository), issue #518.

- App `lefthook.yml` with `extends: [preset]` and a `pre-push` job `typecheck` with a new `run`: `lefthook dump` shows
  the preset's `npx tsc --noEmit`. The same job with `skip: true` keeps the skip, because the preset sets no `skip`.
  The merged job list is reordered (the app's named jobs first), which matters for a `piped` hook.
- `extends: [preset, lefthook.app.yml]` with the changed jobs in the second file: the dump shows the app's `run`
  for `typecheck` and `language`, the preset's `lint` and `test`, in the preset's order. Reversed order in `extends`:
  the preset wins. So later `extends` files win, job by job.
- A committed `lefthook-local.yml` also wins, but it is lefthook's per-developer override file.
- The repository has `lefthook` ^2.1.16 as a devDependency, so a test can run `lefthook dump` on a scratch folder.
- A Next.js app's typecheck is `next typegen && tsc --noEmit` (route types); the preset runs bare `tsc --noEmit` in
  `pre-commit` and `pre-push`.
