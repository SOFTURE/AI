---
change_id: ui-app-components-407
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: ui-app-components-407

Reviewed: the branch diff against plan.md, change.md, issue #407 and its comment.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: the stepper connector became a `connector` slot element (the class scan cannot read `content-['']`), and the app bar's inner width is `w-full` instead of a fixed `max-w-*` (no container token); apps set their width through `classNames.inner`. | Accepted; README lists the slots. |
| 2 | Warning | `ConfirmActionButtonProps` turned from an interface into a type alias (the `action`/`formAction` union): an app that `extends` it must switch to `&`. Same move as `TextFieldProps` in 0.1.16. | Accepted; CHANGELOG says so. |
| 3 | Check | `enter-leave` never hangs: no running transition closes at once, a missing `transitionend` is capped by a timer, and an owner that keeps the dialog mounted gets it back `open` (tested). Default `enter` keeps today's behaviour; the only markup change is `data-state="open"` on overlay and panel. | No change. |
| 4 | Check | `CheckboxField` focuses the box only when it is the form's first invalid control (checked through `validity`, tested with an earlier invalid field), so two required fields never fight for focus. | No change. |
| 5 | Check | `src/ui/` imports no Next module (ESLint NFR-3); `src/next/` imports `next/link` and `next/navigation` by bare specifiers with `next-modules.d.ts`; the example app's `next build` passed with it. `next` is an optional peer; `package-lock.json` carries it. | No change. |
| 6 | Check | Guards: every new component passes the #403 guards (raw colours, inline copy, token classes, native tooltips, hover-only handlers) and the compiled-CSS scan; copy comes from five new message groups in `en` and `pl`. | No change. |
| 7 | Check | Issue item 9 (`ink` variant) already shipped; the comment's class hooks shipped in 0.1.17 (#372). No code for either. | Recorded in change.md. |

Gates: see plan.md Progress.
