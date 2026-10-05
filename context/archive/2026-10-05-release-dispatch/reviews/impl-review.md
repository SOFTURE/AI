# Implementation review: release-dispatch

Scope: full · Date: 2026-10-05 · Commits: 4ad735f · Gates: typecheck ✓ lint ✓ test ✓ (3340 passed, 43 skipped; 6 new planner tests) · build ✓

## Verdict

Ready. The phase delivers the plan; the workflow itself is proven by its first run after the merge
(Manual 1.5), as planned.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | — |
| Correctness | PASS | F1 (observation) |
| Tests | PASS | the planner tests failed first (module missing), then passed |
| Security | PASS | F2 (observation) |
| Patterns | PASS | — |
| Progress honesty | PASS | — |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1. Planner, workflow and runbook | 4ad735f | yes | planner + 6 tests, `auto-release.yml`, runbook section, `release.yml` header, `getDependencyNames` exported for reuse |

`node scripts/release/plan-tags.mjs all` prints the 16 public packages, `core@0.1.0` first, `waitlist@0.1.0`
last; `"blog, seo"` gives `seo@0.1.0` then `blog@0.1.0`; `bad` exits 1 naming `@softure-ai/bad`.

## Findings

### F1 [OBSERVATION] A dispatch on a tag ref relies on release.yml's ref type
`release.yml` gates every publishing job on `github.ref_type == 'tag'` and packs `--tag "$GITHUB_REF_NAME"`;
both hold for `workflow_dispatch` with a tag ref, so no job changed. Its "Tag is on master" step still guards the
commit. No action.

### F2 [OBSERVATION] Tags created by the workflow
They are created by `GITHUB_TOKEN`, so they start no `push` run of `release.yml` (no duplicate release); the
explicit `gh workflow run` is the only start. The `packages` input reaches the shell through env and only as an
argument of the planner, which accepts known public names or `all`. No action.
