# Implementation review: ui-action-form-submit-slot

Reviewed: the branch diff against plan.md (Phase 1, D1–D2) and issue #230.

Verdict: **approve** (no blocking findings).

## Against the plan

- D1: `ActionFormSlot` is `"root" | "actions" | "submit" | "cancel"`, `DEFAULT_CLASSES.submit` is empty and both
  submit buttons get `className={slot("submit")}` (`foundation/ui/src/ui/action-form.tsx`). Matches.
- D2: JSDoc on `ActionFormSlot`, README sentence after the `cancel` one, CHANGELOG `0.1.12`, `package.json`
  0.1.12. Matches.
- Tests: `foundation/ui/tests/adoption-gaps-230.test.tsx`, four cases (page branch, modal branch and Cancel,
  unstyled, unchanged without the slot). Seen red before the code (3 of 4 failing; the "unchanged" case passes on
  both sides by design), green after.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Suggestion | `package-lock.json` also moves `modules/mcp-access` from 0.1.6 to 0.1.7: master's lockfile lagged behind its `package.json` (released 0.1.7). Regenerating the lock is the repo's tooling; the line only realigns it. | Kept, named in the commit. |
| 2 | Check | Without the slot `slot("submit")` is `undefined`, so `Button` renders exactly as before (test 4 compares two renders). Backward compatible. | No change. |
| 3 | Check | Unstyled: the slot getter returns the app class alone and the unstyled `Button` carries it alone (test 3). | No change. |

## Gates

`npm run typecheck`, `npm run lint`, `npm run build` green; `npm test` green (see the commit's pre-push run).
