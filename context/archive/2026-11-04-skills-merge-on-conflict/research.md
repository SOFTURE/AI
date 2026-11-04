# Research: skills-merge-on-conflict

## Findings

- Forge: `master` unprotected, no rulesets, `allow_update_branch: false`, `allow_auto_merge: true`. A pull request
  behind `master` without conflicts is mergeable as it is.
- CI (`.github/workflows/ci.yml`) runs on `pull_request` and on push to `master`; `concurrency` cancels older runs of
  the same pull request. Any new commit on the pull request re-runs every job. Job times of a recent run: unit and
  repository tests 21m52s, fixture film 5m51s, the rest under 3 minutes each.
- `@softure-ai/skills` 0.10.0 (installed): Merging says "Right before merging, merge the fresh main branch into the
  branch". 0.15.0 (latest): "Merge the main branch in only when needed" (`autonomy.remergeMain`, default
  `when-needed`), with `wt-merge-check.py` deciding `merge-as-is` or `remerge`; a remerge re-runs only what it can
  break. `when-needed` still remerges on an incoming migration, dependency change or overlapping file, which is
  broader than the owner's "only on conflicts", so a project rule narrows it.
- 0.15.0 also changes other coordinator and thread rules (startable set, stale go, own CI watch, roadmap state on
  the main branch). `worktree.cloudState: "branch"` keeps the old roadmap flow, and this project runs from issues.

## Options

1. Bump skills only: fewer remerges, but still on migrations and dependency changes.
2. Bump skills and add the project rule "only on a conflict" (chosen: matches the owner's order, keeps the package
   current).
3. Project rule only: leaves the stale managed block contradicting it.
