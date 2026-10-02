# Plan review: release-pipeline

Reviewed: plan.md @ 2026-10-02. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 4 warning, 1 suggestion.
Grounding: 9/9 paths, 3/3 symbols (`findWorkspaces`, `orderWorkspaces`, `REPO_ROOT`), 4/4 commands (`npm run build`, `npm pack --json`, `npm stage publish --help` read from npm 12.2.0, `npm view`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: every Outcome part (validate, npm with provenance, GitHub Packages, GitHub Release, dry run) has a phase and a Progress item |
| Contracts between steps | PASS: `checkManifest` / `checkPackedFiles` signatures are used as written by `pack.mjs`; pack outputs feed the workflow |
| Security | FAIL (W1) |
| Failure modes | FAIL (W2, W3) |
| Parallel work | FAIL (W4) |
| Tests | PASS (S1 applied) |
| Lessons | PASS: L-001 honoured, no bundler |

## Findings

### W1 [WARNING] Script injection through the tag name or the dispatch input
**Effort:** low. **Lens:** Security. **Where:** Phase 4, step 1
**Problem:** a `run:` block that interpolates `${{ github.ref_name }}` or `${{ inputs.package }}` executes whatever the text contains; tag names and dispatch inputs are user-controlled.
**Fix:** pass them through `env:` and let the pack script validate them first.
**Decision:** Fix now (applied) - a Critical details bullet states the rule for every user-controlled value.

### W2 [WARNING] Registry errors read as "package absent"
**Effort:** low. **Lens:** Failure modes. **Where:** Phase 4, step 1 (`publish-npm`, `publish-github`)
**Problem:** SKILLS treats any non-zero `npm view` as "not published yet" (`../SKILLS/.github/workflows/release.yml:76-80`). During an outage that would try to publish again or ask for a token that is not needed.
**Fix:** only `E404` means absent; other errors fail the job.
**Decision:** Fix now (applied) - Critical details bullet added.

### W3 [WARNING] Re-running a tag while a stage waits for approval
**Effort:** low. **Lens:** Failure modes. **Where:** Phase 4, step 1
**Problem:** a staged version is not visible to `npm view`, so a re-run stages the same version again.
**Fix:** cannot be checked reliably without a stable `npm stage list --json` contract; fail loudly and document.
**Decision:** Accept risk - nothing goes live twice (npm refuses the duplicate); the runbook says to approve or reject the pending stage first. Recorded under Risks and rollback.

### W4 [WARNING] New package-shape rules land on FD-3's package
**Effort:** low. **Lens:** Parallel work. **Where:** Phase 2, step 3
**Problem:** FD-3 copies the template into `foundation/core` in parallel. After this change merges, `packages.test.ts` requires `src` in `files`, `repository` and `publishConfig`, which FD-3's copy will not have.
**Fix:** the failures name the field; the coordinator tells FD-3 when FD-2 merges.
**Decision:** Accept risk - three manifest fields, fixed in FD-3's next back-merge; the merge message to the coordinator names them.

### S1 [SUGGESTION] "excludes tests" was not checkable
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, step 3
**Problem:** the rule did not say what counts as including tests.
**Decision:** Fix now (applied) - "no entry is `tests` or starts with `tests/`".

## Triage summary
Fixed: W1, W2, S1. Accepted: W3, W4. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- Every finding triaged without the owner (`--auto`): warnings fixed unless the fix needs an npm contract that does not exist yet (W3) or work in another item (W4).
