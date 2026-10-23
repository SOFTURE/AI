---
change_id: deploy-integration-ref-delete-684
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and change.md.

- Scope: the step now calls `DELETE repos/<repo>/git/refs/heads/<branch>`, the endpoint GitHub documents; nothing
  else in the workflow changed.
- Test: the `gh` stub answers 404 for any path but `git/refs/heads/...`, and the test asserts the exact call for the
  default and a custom prefix, no call for `main` or a tag, the 422 "already gone" pass and the 403 failure. On the
  old path it fails with "Not Found (HTTP 404)"; on the new one it passes. The call log lives in the step's own temp
  directory, which `runStep` removes.
- Shell: unchanged constructs, bash 3.2 safe; the stub is POSIX `sh`.
- Changelog: `## Unreleased` names the fix and tells an adopting app to delete the refs earlier runs left.
- Gates: typecheck, lint and language through the hooks; `tests/repo` green (653 passing).

Verdict: approved, no changes.
