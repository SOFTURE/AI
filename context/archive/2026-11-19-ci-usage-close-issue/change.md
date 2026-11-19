---
change_id: ci-usage-close-issue
title: "ci-usage can keep its report issue closed"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-cycecw
created: 2026-11-19
updated: 2026-11-19
archived_at: 2026-11-19
---

## Intent

A repository that acts on its CI usage report (each optimisation becomes an issue of its own) does not keep the
report itself open in its issue queue. The report is still updated every run and still found by its label.

## Context

The owner asked for it after an adopting app finished the optimisations its report found and the report issue
stayed open. Closing it by hand is not enough: `publish` looked only at open issues, so the next run would open a
new one.

## Notes

- Frame skipped: the request is a small, explicit option; the cause (open-only lookup) is known from the code.

## Done

- `@softure-ai/ci-usage` 0.1.3: `publish --close`, workflow input `close-issue` (default `false`). Release: right
  after the merge (`auto-release.yml`, `ci-usage`); the adopting app then sets `close-issue: true` and pins the
  reusable workflow to the merge commit.
