---
change_id: roadmap-later-promote
title: "roadmap: promote the queued later roadmap; reports around the clock"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-0cxmlv
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

The queued `later` roadmap (LT-4 Dependabot configuration, LT-5 security alerts as issues) becomes the main roadmap,
so the coordinator can start one thread per ready item, and the coordinator's reports run around the clock.

1. `context/foundation/roadmaps/roadmap-later.md` becomes `context/foundation/roadmap.md` (`status: ready`); its two
   backlog entries move to `context/changes/<id>/backlog-input.md`; the empty backlog folder and the index rows go.
2. `context/workflow.json` → `autonomy.reports.hours` is `null` (was `"10:00-22:00"`), the managed block's
   recommendation for an autonomous run.

## Context

The owner's word in the project chat (2026-11-05): change the configuration and take on the queued work, in parallel
threads. The forge had no open issues and no open pull requests at the start of the change.

## Constraints

- No item is implemented here; the item threads take LT-4 and LT-5.
- English only; the roadmap stays within the WORKFLOW §5 contract (`tests/repo/roadmap-contract.test.ts`).

## Notes

- Research: skipped. The inputs are the queued roadmap and WORKFLOW §5.1 (promotion); nothing to investigate.
- Framing: skipped. The owner named the outcome.
