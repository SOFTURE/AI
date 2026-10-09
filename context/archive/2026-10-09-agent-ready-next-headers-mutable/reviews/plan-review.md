---
change_id: agent-ready-next-headers-mutable
reviewed: 2026-10-09
verdict: approved
---

# Plan review: agent-ready-next-headers-mutable

Checked plan.md against change.md, issue #304, `src/link-header.ts`, `tests/architecture.test.ts` and Next 16's
`Header` type.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | A runtime-only test cannot be red for a type error; the red signal is `npm run typecheck`, which covers `tests/**`. | Accepted: the plan names typecheck as the red gate. |
| 2 | Check | The architecture test forbids `next` imports in the root entry's source, not in tests; a type-only import in the test is allowed. | No change. |
| 3 | Suggestion | Typing the README example as `NextConfig` makes it the exact case the issue reports. | Accepted in Phase 2. |
| 4 | Check | Dropping `readonly` widens nothing at runtime: every call returns new arrays. | No change. |

No Critical findings. Research and framing skips are justified in change.md.
