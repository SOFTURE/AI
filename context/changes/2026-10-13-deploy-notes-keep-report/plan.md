---
change_id: deploy-notes-keep-report
status: planned
---

# Plan: deploy-release-notes.yml keeps the report sections (issue #436)

Input: change.md, research.md. Complexity: small (one workflow, two callers, tests, docs).

## Phase 1: keep-report input (TDD)

Files: `.github/workflows/deploy-release-notes.yml`, `tools/deploy/examples/release-notes.yml`,
`tools/deploy/templates/.github/workflows/release-notes.yml.tmpl`, `tests/repo/deploy-workflows.test.ts`,
`tools/deploy/README.md`, `tools/deploy/CHANGELOG.md`.

1. Tests first (repository test, fake `gh` that answers `release view` from a fixture file):
   - the input `keep-report` is a boolean defaulting to `false`;
   - `keep-report=true` with a current body carrying sections: the result is the new text, a blank line, then the
     current body from the first marker byte for byte (trailing newline included);
   - `keep-report=true` without a marker: the result is the body alone, as today;
   - `keep-report=false`: `gh release view` is not called, the body replaces everything;
   - `keep-report=true` with a marker inside `body`: "Check the inputs" refuses it;
   - the example caller exposes `keep-report` (boolean, default `true`) and passes it on.
2. Implement in the workflow: new input, the check, and the edit step reading the current body when asked.
3. Callers: example and template gain the input and pass it on.
4. Docs: README "Edit release notes"; CHANGELOG `## Unreleased`.

## Progress

- [ ] Phase 1: keep-report input
