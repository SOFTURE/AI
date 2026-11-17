---
change_id: quality-review-security-coverage-1325
status: planned
---

# Plan: security coverage evidence and a minimum coverage step (issue #1325)

Input: change.md, research.md. Complexity: medium.

## Phase 1: coverage blocks and the report (TDD)

Files: `src/coverage.ts` (new), `src/findings.ts`, `src/report.ts`, `src/index.ts`, `tests/coverage.test.ts`,
`tests/report.test.ts`.

- `SECURITY_SCENARIOS` (the nine rules of the prompt plus `secrets` and `runtime-hardening`), a zod schema of a
  `<coverage>{json}</coverage>` block (`scenario`, `status: traced | no-surface`, `files`, `note`), `extractCoverage`,
  `resolveCoverage(entries, filesRead)` giving one entry per scenario (`traced`, `no-surface`, `not-covered`), the
  traced files narrowed to files read, and `getMissingScenarios`.
- `runtime-hardening` joins `CATEGORY_RULES.security`.
- Report: optional `turns`, `filesRead`, `coverage` in the header; `Turns` and `Files read` rows; a `## Coverage`
  table before the findings with a note when a scenario is not covered; `parseReport` reads them back and refuses an
  unknown scenario or status. A general report is byte for byte the 0.2.0 one.
- Done when: tests for extraction, resolution, render and parse round trip pass; existing report tests unchanged.

## Phase 2: the run tracks reads and asks for missing coverage (TDD)

Files: `src/review.ts`, `src/agent.ts` (types only), `tests/focus-scope.test.ts`, `tests/review.test.ts`.

- A security run sends its task through a prompt stream (one `query()` call); it records Read paths (relative,
  inside the repository) from `tool_use` blocks and `num_turns` from the latest result.
- After a `complete` result with scenarios missing, it sends a follow-up naming them (at most two); otherwise it
  closes the stream. Closed also when the loop throws.
- Header of a security report: turns, files read, coverage.
- Done when: a fake agent that skips scenarios gets a follow-up naming them, the report shows the second turn's
  coverage, a third miss leaves `not covered`, a budget stop gets no follow-up, a general run still passes a string
  prompt.

## Phase 3: prompt, README, CHANGELOG

Files: `prompt/security-review.md`, `README.md`, `CHANGELOG.md`, `tests/focus-scope.test.ts`.

- Prompt: a coverage block per scenario with the example, the tenth scenario, "never end with a scenario unaccounted".
- README: coverage section in "Report format" and the security focus text. CHANGELOG `## Unreleased`.
- Done when: the prompt test names every scenario and the coverage format; gates green (`npm run typecheck`,
  `npm run lint`, package tests, `tests/repo`).

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
