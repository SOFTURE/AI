---
change_id: readme-package-catalog
status: in_progress
---

# Plan: README package catalogue and cross-links

Input: change.md. Complexity: small (docs and one repository test).

## Phase 1: guard (TDD)

Files: `tests/repo/readme-layout.test.ts`.

- Parse the first fenced block under `## Repository layout` in `README.md`: a line `<group>/` at column 0 opens a
  group, a line `  <name>/` adds `<group>/<name>`. `theme-<name>/` is a placeholder and is skipped.
- Every workspace directory (`findWorkspaces`) under `foundation/`, `modules/`, `tools/` or `themes/` is listed;
  every listed entry is an existing directory. Red on master (alerts, blog, charts, testing).

## Phase 2: docs

Files: `README.md`, `foundation/llm/README.md`, `modules/jobs/README.md`, `modules/ops/README.md`,
`tools/marketing-kit/README.md`, `modules/alerts/README.md`, and those packages' `CHANGELOG.md`.

- README: lines for charts and testing (foundation), alerts and blog (modules), from their package descriptions;
  theme-notion "37 components".
- One cross-link sentence each in llm, jobs, ops and marketing-kit; the alerts `onQueuePaused` note states the
  breaker is in jobs 0.1.7, the version the package requires.
- `## Unreleased` with a `Docs:` line in each touched package's CHANGELOG.

## Progress

- [ ] Phase 1
- [ ] Phase 2
