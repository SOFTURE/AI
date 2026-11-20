# Plan: doctor-sweep-to-zero

## Approach
WORKFLOW §12.4 in order: mechanical fixes, the sweep settled entry by entry with evidence, the state file, the CI line.

## Phases
### Phase 1: mechanical fixes
- `npx softure-skills doctor --fix --write` (one archived `change.md` stamped `archived`, old value kept as
  `legacy_status`).
- Done when: the doctor lists only judgement cases.

### Phase 2: sweep to zero
- Every `doctor --sweep --json` entry settled in its line: evidence (commit, tag, npm publish, issue or pull request
  state, workflow run), superseded (the later roadmap or change that made it obsolete), carried (the later roadmap
  that took it), or carried to an `owner-word` issue when only the owner can settle it.
- `npx softure-skills state`, then `npx softure-skills doctor` exits 0.

### Phase 3: CI
- A `context contract` job in `.github/workflows/ci.yml`: `npm ci`, `npx softure-skills doctor`.
- Done when: actionlint and the repository tests pass, and the job is green on the pull request.

## Progress
- [x] Phase 1: mechanical fixes — 742d4488 (doctor 21 failures, 20 after --fix)
- [x] Phase 2: sweep to zero (20 entries settled; `npx softure-skills doctor` exits 0)
- [ ] Phase 3: CI
