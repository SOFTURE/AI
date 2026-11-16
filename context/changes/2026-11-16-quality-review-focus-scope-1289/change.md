---
change_id: quality-review-focus-scope-1289
title: "quality-review: a focused security mode (focus, paths) and a scope input for one folder or workspace package (issue #1289)"
status: open
roadmap_item: null
issue: 1289
branch: claude/project-thread-kejqak
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [#1289](https://github.com/SOFTURE/AI/issues/1289). `@softure-ai/quality-review` keeps today's whole-repository
breadth review as the default and gains three inputs that let a run go deep where it matters:

- `focus`: `general` (today, unchanged) or `security`, a second shipped prompt that traces threat scenarios end to
  end (sign-in, OAuth, tokens, webhooks, command execution, outbound requests, secrets) with eight new security rules;
- `paths`: globs; findings are reported only inside them;
- `scope`: one folder or a workspace package by name; findings only inside it, its local context in the prompt, its
  own default report path and ignore file, and its own report branch in the reusable workflow.

## Context

Labels: `enhancement`, `pkg: quality-review`. Requested by the owner. Package `tools/quality-review` and the reusable
workflow `.github/workflows/quality-review.yml`.

## Constraints

- Without `focus`, `paths` and `scope`, the system prompt, the task, the behaviour and the report are byte-for-byte
  what 0.1.1 produces.
- Finding ids stay rule + file + symbol, so scoped and whole-repository runs give the same id.
- An unknown package name or a folder outside the repository fails before any model call.
- No test calls the API. No change in any adopting app's repository.

## Notes

- Framing: skipped. The issue fixes the problem, the proposal and the acceptance with the owner.
