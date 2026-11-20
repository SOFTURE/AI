---
change_id: doctor-sweep-to-zero
title: "settle the context/ history to zero with the doctor and run it in CI"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-v2xvyl
created: 2026-11-20
updated: 2026-11-20
archived_at: 2026-11-20
---

## Intent
`npx softure-skills doctor` (skills 0.22.0) exits 0 on `master` with no baseline, `context/state.json` is written by
the script, and the CI check runs the doctor on every pull request, documentation-only changes included
(WORKFLOW §12.4).

## Constraints
- Touch only `context/` and `.github/workflows/ci.yml`.
- Nothing in flight is touched (the open pull request for auth invites and its change).
- Every tick carries its evidence (SHA, release tag, issue or pull request state, workflow run); no baseline.
- No release, tag or deploy.

## Notes
- research skipped: the doctor's sweep is the research; every entry's evidence is recorded in the line it settles.
- frame skipped: the outcome is the doctor's own contract.

## Decisions (auto)
- The one owner-only entry (off-site backup secrets per adopting app, `2026-11-09-backup-offsite-1210` item 4.3) is
  carried to `context/foundation/roadmap.md` → `## Owner decisions and checks` with its source #1410 (first filed as
  an `owner-word` issue, then closed and carried there on the coordinator's decision, 2026-11-20).
- The doctor runs as its own CI job (`context contract`) in `ci.yml`, which has no paths filter, so it also runs for
  changes that touch only `context/` or other documents.

## Done
`npx softure-skills doctor` exits 0 (21 failures before, 20 after `--fix`, 0 after the sweep), `context/state.json`
written by the script, and the `context contract` job in `.github/workflows/ci.yml` runs the doctor on every pull
request. One owner step carried to the roadmap's owner section (source #1410).
