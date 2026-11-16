---
change_id: quality-review-focus-scope-1289
status: in_progress
---

# Plan: quality-review focus, paths and scope (issue #1289)

Input: change.md, research.md. Complexity: medium.

## Phase 1: package

- `findings.ts`: `security` gains `auth-session`, `oauth-flow`, `token-scope`, `webhook-verification`,
  `command-injection`, `ssrf`, `csrf`, `rate-limit`; `FOCUSES = ["general", "security"]`.
- `prompt/security-review.md`: the threat-scenario prompt (same tools, data-not-instructions, emit format), every
  scenario and rule of the issue, attack path in `problem`.
- `scope.ts`: `resolveScope(repo, value)` (folder inside the repository, or a workspace package name through
  `workspaces`) → `{ folder, packageName }` or an error; `getScopeContext` (README, package.json, CHANGELOG head,
  AGENTS.md files between root and scope, test folders); `isInScope`; `getScopeSlug`; `getDefaultReportPath`.
- `review.ts`: inputs `focus`, `paths`, `scope`; the prompt by focus; the task names the scope, paths and local
  context only when set (otherwise the 0.1.1 task); findings outside scope or paths are dropped with a note; scope
  ignore file read with globs relative to the scope.
- `report.ts`: optional header rows `Focus` (only for a non-general focus), `Scope`, `Paths`; the intro names them;
  `parseReport` reads them back; a general unscoped report is unchanged.
- CLI: `run --focus --paths (repeatable or comma separated) --scope`; `--out` defaults to the scope's path; a new
  `resolve` command prints `report-path`, `branch-suffix` (`GITHUB_OUTPUT` lines) and validates the scope with no model
  call.

## Phase 2: workflow, example, docs

- Workflow inputs `focus` (default `general`), `paths`, `scope`; `report-path` and `branch` default empty (resolved:
  `QUALITY-REPORT.md` or `<scope>/QUALITY-REPORT.md`; `quality-review`, `quality-review/security`,
  `quality-review/<scope-slug>`); concurrency group per branch; PR title names focus and scope.
- Examples: `examples/quality-review.yml` gains `focus` and `scope` dispatch inputs; `examples/quality-review-matrix.yml`
  reviews a package list one per job.
- README: inputs, new rules, focus/paths/scope, cost line for security, ignore per scope. CHANGELOG 0.2.0 entry.

## Phase 3: tests

- Security prompt carries every scenario and rule; general run passes the 0.1.1 prompt and task unchanged and its
  report has no new rows.
- Fixture monorepo: package name resolves, unknown name and outside folder fail before the query runs, findings
  outside scope and paths are dropped, the scope README and AGENTS.md reach the task, scope ignore file applies.
- Report round trip with `Focus`/`Scope`/`Paths`; CLI `resolve`; workflow shape test updated.

## Acceptance

- Gates: typecheck, lint, test, build. No test calls the API.

## Decisions (auto)

- No report format bump: the new rows are optional and a general report is unchanged; `check` accepts both.
- Version 0.2.0 (new inputs, no break).
- `report-path` and `branch` inputs default to empty and are resolved by the CLI, so a scoped run never overwrites
  another's report or branch, and an unscoped general run keeps `QUALITY-REPORT.md` and `quality-review`.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
