---
change_id: waitlist-form-on-success-579
reviewed: 2026-10-18
verdict: approved
---

# Implementation review: waitlist-form-on-success-579

Checked commits 12e07c8 and eee9b20 against plan.md and issue #579.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance 1: tests show an app's node and function view in place of the notice, `onSuccess` once with the state (also under Strict Mode, and for `confirmation_sent`), never for a refusal, and focus moved to the app's view from it. Six of them failed before the change. | No change. |
| 2 | Check | Acceptance 2: without the props the render path is today's markup; every earlier form test still passes. | No change. |
| 3 | Check | `onSuccess` runs in an effect after commit; the ref holds the last notified state, so a new `onSuccess` identity on re-render does not call it again. | No change. |
| 4 | Minor | `<Waitlist success>` has no render test: `<Waitlist />` has none today (it needs the registered config). The passthrough is one typed prop. | Accepted. |
| 5 | Check | No Polish, no new copy (the app's view carries its own); the success view keeps the `root` slot. | No change. |

No Critical or Major findings.
