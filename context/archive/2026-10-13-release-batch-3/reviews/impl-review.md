# Implementation review: release-batch-3

Scope: full · Date: 2026-10-13 · Commits: 7bea31f1..c80f8986 · Gates: typecheck ✓ · lint ✓ · tests ✓

## Verdict
Ready. Twenty `chore(release)` commits, each written by `npm run release:version`: package.json, lockfile,
`module.json` / inline manifest and the `## Unreleased` heading renamed to the version. No local tag left.

## Plan coverage
| Phase | Commits | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Widen | 7bea31f1 | yes | ops, db and observability CHANGELOG lines |
| 2: Bumps | 35858eb0..309ad513 | yes | |
| 3: Require | c80f8986 | yes | ranges, `dependsOn`, deploy workflow defaults and README pin, tests |

Versions: core 0.2.0, ui 0.3.0, charts 0.2.0, agent-ready 0.2.0, analytics 0.2.0, auth 0.2.0, billing 0.3.0,
blog 0.2.0, feature-switches 0.2.0, mailing 0.2.0, mcp-access 0.2.0, ops 0.2.0, privacy 0.2.0, security 0.2.0,
seo 0.2.0, waitlist 0.2.0, deploy 0.2.0, marketing-kit 0.2.0, db 0.1.9, observability 0.1.3. Not released: testing,
config (no entries, no internal dependencies).

## Findings
- Raising `dependsOn` broke the tests that pin the error text of a missing required module (auth, billing,
  feature-switches, mcp-access, privacy, waitlist) and the privacy test fixture module `notes` (`auth ^0.1.0`, which
  0.2.0 no longer satisfies). Updated to the new ranges.
- The charts architecture test pinned the ui peer range. Updated to `^0.3.0`.

## Decisions (auto)
- none beyond change.md.
