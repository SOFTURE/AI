---
change_id: skills-merge-on-conflict
title: "rules: merge master into a branch only on a conflict; @softure-ai/skills 0.15.0"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-7loxh1
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Stop re-running the whole CI (about 25 minutes, the unit and repository tests job alone about 22) on a pull request
that is already green, just because the main branch moved before its merge. After this change:

1. `@softure-ai/skills` is `^0.15.0` (was `^0.10.0`, which in 0.x resolves to 0.10.x only), so the managed block in
   `AGENTS.md` carries the 0.15.0 rule "Merge the main branch in only when needed" and `wt-merge-check.py` is installed;
2. a project rule outside the managed block narrows it further, on the owner's order: the main branch is merged into a
   branch before its merge only when the forge reports the pull request has a conflict. Otherwise the pull request is
   merged as it is, on the checks that were green at READY. The coordinator's go never asks for an "Update branch".

## Context

Owner request in chat (2026-11-04): a green pull request was updated with the fresh main branch before its merge,
which started a new CI run; the owner asked to back-merge only on conflicts. Facts checked: `master` has no branch
protection and no ruleset (`GET /branches/master/protection` answers 404, `GET /rulesets` answers `[]`), so GitHub
does not require an up-to-date branch; `allow_update_branch` is off. The update came only from the managed rule
"Right before merging, merge the fresh main branch into the branch" (skills 0.10.0).

Files: `package.json`, `package-lock.json`, `AGENTS.md` (managed block via the installer, plus one project section).

## Constraints

- English only; no change to the repository settings.
- The managed block is written only by the installer, never by hand.

## Notes

- Research: kept short. The question is a rules question; the facts are the forge settings above and the 0.15.0
  package contents, recorded in research.md.
- Framing: skipped. The owner named the outcome.
