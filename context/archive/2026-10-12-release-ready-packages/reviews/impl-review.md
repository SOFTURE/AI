# Implementation review: release-ready-packages

Scope: full · Date: 2026-10-12 · Commits: 3e020cd..086c144 · Gates: typecheck ✓ · lint ✓ · tests ✓ (the pre-push hook runs `npm test` again with deploy)

## Verdict
Ready. Eleven `chore(release)` commits, each written by `npm run release:version`: package.json, lockfile,
`module.json` / inline manifest and the `## Unreleased` heading renamed to the version. No local tag left.

## Plan coverage
| Phase | Commits | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Patch bumps | 3e020cd..086c144 | yes | deploy added after #396 merged |

Versions: charts 0.1.8, core 0.1.10, observability 0.1.2, ui 0.1.17, blog 0.1.12, mailing 0.1.13,
mcp-access 0.1.14, ops 0.1.10, privacy 0.1.12, config 0.1.2, deploy 0.1.10.

## Findings
- The deploy bump left the reusable workflows defaulting `deploy-cli-version` to 0.1.9 (`tests/repo/deploy-workflows.test.ts` failed in pre-push). Fixed: the three workflows and the README pin example now say 0.1.10.

## Decisions (auto)
- none beyond the plan review.
