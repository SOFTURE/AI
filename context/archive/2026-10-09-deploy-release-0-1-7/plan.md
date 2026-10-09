# Plan: deploy-release-0-1-7

Input: change.md (research and framing skipped, reasons in change.md). Complexity: trivial (one phase).

## Goal

`@softure-ai/deploy` is 0.1.7 on master, with the Unreleased CHANGELOG entries under `## 0.1.7`, ready for
`auto-release.yml`.

## Key decisions

- **D1 Version 0.1.7** (patch, as for every 0.1.x deploy release): `tools/deploy/package.json` and the lockfile.
- **D2 CHANGELOG.** `## Unreleased` becomes `## 0.1.7`; entries unchanged.
- **D3 Workflow defaults.** `deploy-cli-version` defaults to 0.1.7 in the three reusable deploy workflows, as
  `tests/repo/deploy-workflows.test.ts` requires; the tag's commit then defaults to its own CLI.
- **D4 README.** The `git ls-remote ... deploy@<version>^{}` example names 0.1.7.

## Phase 1: bump

- [x] D1-D4.
- [x] Gates: typecheck, lint, `tests/repo/deploy-workflows.test.ts` and the deploy package tests.

## Progress

- 2026-10-09: phase 1 done.
