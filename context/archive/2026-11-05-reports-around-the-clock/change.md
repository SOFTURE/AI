---
change_id: reports-around-the-clock
title: "config: coordinator reports around the clock"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-0cxmlv
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

`context/workflow.json` → `autonomy.reports.hours` is `null` (was `"10:00-22:00"`), so the report routine, which is
also the run's heartbeat, fires around the clock, as the managed block recommends for an autonomous run.

## Context

The owner's word in the project chat (2026-11-05): change only the report hours.

## Notes

- Research: skipped. One configuration key named by the owner.
- Framing: skipped. The owner named the outcome.
