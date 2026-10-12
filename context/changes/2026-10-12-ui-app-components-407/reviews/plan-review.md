---
change_id: ui-app-components-407
reviewed: 2026-10-12
verdict: approved
---

# Plan review: ui-app-components-407

Checked plan.md against change.md, research.md, issue #407 (and its comment) and the files it touches.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `findInlineCopy` reads ARIA attributes: the colour input's name and the "completed" note must come from messages, not literals. | Taken: new message groups `colorField`, `stepper`, `checklist`, `suggestedAmount`, `appShell`. |
| 2 | Warning | `useSearchParams` in a statically rendered route needs a `Suspense` boundary in Next 16, or the build bails out. | Taken into Phase 3 and the README: the adapter documents it; the example app is not changed. |
| 3 | Warning | `enter-leave` must never hang a close: a panel without transitions (jsdom, `prefers-reduced-motion`, `unstyled`) closes at once, and a timer caps the wait. | Taken into Phase 3 tests. |
| 4 | Warning | `CheckboxField`'s `preventDefault` on `invalid` also suppresses the focus move the browser makes; the field must focus itself only when it is the first invalid control, or two required fields fight for focus. | Taken into Phase 1 tests. |
| 5 | Check | `formAction` and `action` as a union keeps existing callers compiling (`action` stays as is). | No change. |
| 6 | Check | `src/next/` importing `next/link` and `next/navigation` by bare specifiers needs `next-modules.d.ts` (L-002). | Already in Phase 3. |

No Critical findings.
