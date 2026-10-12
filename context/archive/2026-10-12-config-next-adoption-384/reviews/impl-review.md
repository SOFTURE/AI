---
change_id: config-next-adoption-384
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: config-next-adoption-384

Checked the diff against change.md, plan.md and issue #384.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `.ts` files with no `extends` get the same rule set: the same typescript-eslint objects, with `files` added; the existing 12 ESLint tests pass unchanged. | No change. |
| 2 | Check | The plugin stays registered for every file (an unscoped `softure/typescript-plugin` object), as the plan review asked. | No change. |
| 3 | Warning | The reused plugin comes from the app's `extends`, while the rule settings come from the preset's typescript-eslint. A rule missing in an older copy would fail to load; within the `^8.46.0` peer range the recommended type-checked set exists. The README says to keep one copy. | Documented, no code. |
| 4 | Check | The test parser stub wraps typescript-eslint's parser without type information instead of importing an undeclared parser package. | No change. |
| 5 | Check | No Polish outside the exempt folders; no version bump; CHANGELOG `## Unreleased`. | No change. |

No Critical findings. Every ask of issue #384 is covered: peers (1), the `.mjs` failure fixed in code (2), README lines
for `noUncheckedIndexedAccess`, the lefthook skip and the ESLint cost (3).
