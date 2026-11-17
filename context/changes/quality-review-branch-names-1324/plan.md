# Plan: quality-review report branch names that coexist (#1324)

## Approach

Move the default report branch name into the CLI (`getReportBranch`), print it from `resolve` as `report-branch=`,
and let the workflow use it when `branch` is empty. The names are flat (no `/`), so none can block another.

## Phases

### Phase 1: names (test-first)

- Tests: `tools/quality-review/tests/focus-scope.test.ts` "branch names" asserts the four shapes
  (`quality-review-general`, `quality-review-security`, each with `--<slug>`), that no name is a `/`-prefix of
  another or of a 0.2.0 name (`quality-review`, `quality-review/...`); the resolve test expects the `report-branch=` line.
- `tools/quality-review/src/cli/command.ts`: `getReportBranch`, the new resolve line.
- `.github/workflows/quality-review.yml`: the resolve step reads `report-branch=`, falls back to the 0.2.0 scheme;
  input description and header comment name the new branches.
- `tests/repo/quality-review-workflow.test.ts`: the resolve step uses `report-branch`.
- README inputs table and `resolve` paragraph; CHANGELOG `## Unreleased`.
- Done when: `npx vitest run tools/quality-review tests/repo/quality-review-workflow.test.ts` passes,
  `npm run typecheck` and `npm run lint` pass; the workflow's resolve step, run as bash against the built CLI for the
  four focus and scope pairs, prints the four names (recorded on the Progress item).

## Progress

- [ ] Phase 1: names
