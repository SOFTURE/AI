# Implementation review: release-batch-2

Scope: full · Date: 2026-10-12 · Commits: f4143f0..0437448 · Gates: typecheck ✓ · lint ✓ · tests ✓

## Verdict
Ready. Sixteen `chore(release)` commits, each written by `npm run release:version`: package.json, lockfile,
`module.json` / inline manifest and the `## Unreleased` heading renamed to the version. No local tag left.

## Plan coverage
| Phase | Commits | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Ranges | f4143f0, e62c4ac | yes | the auth and core ranges moved after their bumps (see Findings) |
| 2: Bumps | bff5b33..0437448 | yes | deploy workflow defaults and README pin follow 0.1.11 |

Versions: ui 0.2.0 (minor, breaking `ConfirmActionButtonProps`), core 0.1.11, auth 0.1.13, charts 0.1.9, db 0.1.8,
testing 0.1.5, agent-ready 0.1.4, blog 0.1.13, mcp-access 0.1.15, seo 0.1.9, deploy 0.1.11, billing 0.2.1,
feature-switches 0.1.8, mailing 0.1.14, privacy 0.1.13, waitlist 0.1.11.

## Findings
- Raising the mcp-access, seo and blog ranges before core and auth were bumped made `npm install` look for
  unpublished versions on the registry. Fixed: those ranges moved in their own commit after the core and auth bumps.
- The ui dev ranges keep `^0.1.7 || ^0.2.0` instead of `^0.2.0` for the same reason; they accept the workspace
  version either way.

- The charts architecture test pinned the ui peer range at `^0.1.6`. Updated to the widened range.

## Decisions (auto)
- none beyond change.md.
