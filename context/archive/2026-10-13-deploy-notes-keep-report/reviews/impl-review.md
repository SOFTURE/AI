---
change_id: deploy-notes-keep-report
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: deploy-notes-keep-report

Reviewed: the branch diff against plan.md, change.md and issue #436.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. With sections, the written body is the new text, a blank line, then the current body from the first marker byte for byte (tested with `$(id)` in the kept part and a trailing newline). | No change. |
| 2 | Check | Plan review 1: only the exact string `true` turns it on; `false` and an empty value never call `gh release view` (tested). | No change. |
| 3 | Check | Plan review 2: the current body is read with `read -d ''`, so trailing newlines survive; `--template '{{.body}}'` adds none. | No change. |
| 4 | Warning | The edit step reads `${KEEP_REPORT:-}` because `set -u` is on and an older caller test runs it without the variable; in Actions the variable is always set. | Accepted. |
| 5 | Warning | View and edit are not atomic; a deploy that writes a section in between loses that write until its next run. | Accepted (research, risks). |
| 6 | Check | Callers: example and template stay equal when parsed (`generate.test.ts`), both default `keep-report` to `true`. Docs: README "Edit release notes" and the init table, CHANGELOG `## Unreleased` (no version bump, batched releases). | No change. |

Gates: see plan.md Progress.
