# Implementation review: marketing-kit-render-ci

Scope: full · Date: 2026-10-03 · Commits: f8377b3, ac37f0e (plus master merge e36b1bc) · Gates: typecheck ✓ lint ✓ test ✓ (2302 tests, 25 skipped) · CI on ac37f0e: all green, `render` job ✓

## Verdict
Ready. The `render` job of `ci.yml` runs the fixture film end to end on every push and pull request: in run
37161219144 the render test passed in 82 s on hyperframes' own chrome-headless-shell
(`/home/runner/.cache/hyperframes/chrome/.../chrome-headless-shell`, 152.0.7977.30), the job took about 2 min 10 s.
One finding about the workaround for the hanging `browser ensure`, accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS | F1 (accepted) |
| Tests | PASS | - |
| Security | PASS (no secrets, `contents: read`, no new third-party action) | - |
| Patterns and lessons | PASS | - |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: The render job | f8377b3, ac37f0e | yes | drift recorded in plan.md `## Decisions (auto)` (the `ensure` hang) |

Files: planned and changed 2 (`.github/workflows/ci.yml`, `tools/marketing-kit/README.md`) · unplanned 0. Context files
are workflow bookkeeping.

## Findings

### F1 [SUGGESTION] The step depends on the text "Ready to render."
**Impact:** LOW · **Dimension:** Correctness · **Where:** `.github/workflows/ci.yml`, step "Install hyperframes' Chrome"
**What:** the wait loop keys on hyperframes' success line; a hyperframes upgrade that rewords it makes the step wait
until the process exits (it fails with the log) or the 5-minute step timeout. **Why it matters:** a confusing failure
after an upgrade. **Evidence:** `node_modules/hyperframes/dist/cli.js` `runEnsure` prints `Ready to render.`; the
exit-without-line branch prints the log and fails.
**Fix:** none now; the failure is loud and bounded, and the `browser path` guard still verifies the binary.
**Decision:** accept (auto): hyperframes is pinned exactly (`0.8.85`), so a reword arrives only with a deliberate bump,
which this job then tests.

## Progress audit
- 1.1: job `marketing-kit fixture film render` (job 111314919606) green on ac37f0e; the verbose log lists
  "✓ … renders a 1080×1920 draft MP4 and the post copy 81686ms", 1 passed.
- 1.2: the job env shows `HYPERFRAMES_BROWSER_PATH: /home/runner/.cache/hyperframes/chrome/chrome-headless-shell/...`.
- 1.3: typecheck and lint by the pre-commit hook and the `static` job, `npm test` by the pre-push hook (2302 passed) and
  the `test` job, `build` job green.

## Triage summary
Fixed: -. Accepted: F1. Deferred: -. Withdrawn: -.

## Lessons proposed
none.

## Decisions (auto)
- F1 success-line dependency → accept (pinned dependency, bounded failure).
