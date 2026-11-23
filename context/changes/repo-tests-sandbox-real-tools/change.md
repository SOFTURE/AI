---
change_id: repo-tests-sandbox-real-tools
title: "tests: the gh setup sandbox links real tools, not PATH wrappers (issue #1424)"
status: impl_reviewed
roadmap_item: null
issue: 1424
branch: claude/project-thread-w5125f
created: 2026-11-23
updated: 2026-11-23
---

## Intent

The sandbox of "the GitHub CLI setup step" tests links real executables, so a wrapper script first on `PATH` (one that
calls the next tool of the same name on `PATH`) no longer breaks the four tests that run `rm`, and a dependency push from
such a container passes the pre-push hook.

## Context

Issue #1424 (no labels). `makeSandbox` in `tests/repo/workflow-runners.test.ts` symlinks the first `command -v <tool>`
hit. In a container whose `PATH` starts with a guarded `rm`, the link points at the wrapper, which finds no other `rm`
inside the sandbox `PATH` and exits 127.

## Scope

- Test-only change in `tests/repo/workflow-runners.test.ts`: resolve each sandbox tool from the system directories
  (`/usr/bin`, `/bin`) first, then fall back to the `PATH` lookup.
- A test for the resolver with a wrapper `rm` first on `PATH`.

## Constraints

- bash 3.2 and BSD tools on macOS keep working; the sandbox still never contains the machine's own `gh`.

## Notes

- frame skipped: the issue names the defect and a fix; no product question.
