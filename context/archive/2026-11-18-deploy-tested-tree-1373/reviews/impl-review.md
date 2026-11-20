# Implementation review: deploy-tested-tree (#1373)

Verdict: approve.

- Matches the plan: one API-only job with the shared runner check and GitHub CLI setup, an input check that fails on
  invalid inputs, and a compare step that answers `"false"` with a notice on every doubt and exits 0 (tested for an
  unreadable tag, no merged pull request, an unreadable comparison, a truncated or unreadable tree, unreadable check
  runs, a missing default branch).
- Tree comparison covers mode, blob and path, so a changed mode, an added and a removed file all answer `"false"`;
  `ignore-prefixes` must end in `/`, so `context` cannot also hide `contextual.ts`.
- Checks: `filter=latest` gives the newest run per name; a skipped, running or red match, or no match, answers
  `"false"`. Globs cover matrix shards.
- The fail-fast example's `build` names each result, so a `unit` skipped because a needed job failed never counts as
  passed; `tested` has its own watcher.
- bash 3.2: no arrays, `[[ == ]]` globbing, `awk` reads the prefixes from `ENVIRON`, `comm`, `paste -s -d ' ' -` and
  `sort` are common to BSD and GNU; the macOS job runs these tests.
- Inputs never interpolated into a script (the repository test guards it); permissions are read only.
- Release: `@softure-ai/deploy` 0.7.4 (patch: no CLI change, dependents' ranges `^0.7.0` keep matching) and
  `deploy-cli-version` 0.7.4 in the three workflows.
