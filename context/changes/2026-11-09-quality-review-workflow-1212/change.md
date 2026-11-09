---
change_id: quality-review-workflow-1212
title: "quality-review: a reusable, on-demand, read-only Agent SDK review that writes QUALITY-REPORT.md through a pull request (issue #1212)"
status: in_progress
roadmap_item: null
issue: 1212
branch: claude/project-thread-y3ust4
created: 2026-11-09
updated: 2026-11-09
---

## Intent

Close [#1212](https://github.com/SOFTURE/AI/issues/1212). An adopting app starts a whole-repository quality review by
hand with a few lines of YAML. A read-only agent on the Claude Agent SDK (`Read`, `Glob`, `Grep` only) reviews the
whole repository against the app's `AGENTS.md`, every finding verified in the code, under a hard per-run cost cap. The
result is a `QUALITY-REPORT.md` in a fixed, documented format, delivered as one pull request, never a push to the
main branch.

## Context

Labels: `enhancement`. Requested by the owner. New tool package `@softure-ai/quality-review` (the CLI the reusable
workflow runs, like `@softure-ai/deploy` for the `deploy-*` workflows).

## Constraints

- Agent SDK, not `claude-code-action`: billed as API usage with `ANTHROPIC_API_KEY`, a repository secret.
- Read-only agent: `Read`, `Glob`, `Grep`; no edits, shell, network, MCP or project settings.
- On demand only (`workflow_dispatch` / `workflow_call`), always a full review, each run replaces the report.
- Budget input, default 10 USD; real cost, model and tokens in the report header.
- No test calls the real API. No change in any adopting app's repository.

## Notes

- Framing: skipped. The issue fixes the problem, the outcome and the deliverables with the owner.
