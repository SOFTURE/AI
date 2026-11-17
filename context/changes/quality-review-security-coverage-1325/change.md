---
change_id: quality-review-security-coverage-1325
title: "quality-review: a security run proves its coverage before it may end clean (issue #1325)"
status: open
roadmap_item: null
issue: 1325
branch: claude/project-thread-el8hz7
created: 2026-11-17
updated: 2026-11-17
---

## Intent

Close [issue #1325](https://github.com/SOFTURE/AI/issues/1325): four `focus: security` runs of 0.2.0 on an adopting
app ended `complete` with 0 findings after about a minute and 3–6% of the budget. A clean security report cannot tell
"traced every scenario and found nothing" from "stopped early". The run must record what it traced, with evidence,
and must not end before every threat scenario is either traced or marked as having no surface.

## Context

Labels: `enhancement`, `pkg: quality-review`. Package: `@softure-ai/quality-review` 0.2.0 (`tools/quality-review`).
Issue #1324 (default branch names) runs in parallel on the same package: it owns the workflow file,
`src/cli/command.ts` and the branch-name tests; neither change bumps the version, and the thread that merges second
cuts the 0.3.0 release (agreed between the threads).

## Scope

- The security prompt asks for one `<coverage>` block per threat scenario (traced with the files read, or no surface
  with the searches that show it) and adds a runtime and deployment hardening scenario (container capabilities,
  privilege escalation, a response plan for a compromised host or a leaked secret).
- The run counts the files the agent read and the turns it used; a coverage entry names only files it really read.
- A minimum coverage step: when a security run ends with scenarios not covered, the same session gets a follow-up
  turn (at most two) naming them, inside the same budget.
- The security report gains `Turns` and `Files read` header rows and a `## Coverage` section (scenario, status,
  files, note); `check` validates them.
- README and CHANGELOG (`## Unreleased`).

## Constraints

- A general run keeps its prompt, task, agent call and report exactly as in 0.2.0.
- Read-only agent, no new tools; the cost cap stays one hard cap for the whole run.
- No version bump in this change.

## Notes

- Framing: skipped. The issue's two suggestions are the fix; research checks the SDK supports a follow-up turn
  inside one budget.
