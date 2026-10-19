---
change_id: waitlist-form-look-593
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: waitlist-form-look-593

Reviewed: the branch diff against plan.md, change.md and issue #593.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Button: default keeps `primary` and `sft:w-full`; `submitFullWidth={false}`, `submitVariant="ink"` and `classNames.submit` reach the button (form test and `Waitlist` markup test). An empty `submit` slot gives ui `undefined` for `classNames.root`, so default markup is unchanged. | No change. |
| 2 | Check | Email field: `emailProps.id`, `placeholder` and `fieldClassNames.label` reach the input and its label; no placeholder attribute without the prop. | No change. |
| 3 | Check | Consent boxes: `inputId` sets the box id and survives the remount after an answer (checked state kept); `description` renders under the box and is the box's `aria-describedby`; a box without one has no `aria-describedby`; `scopeClassNames` reaches every box. | No change. |
| 4 | Check | `Waitlist` forwards only the typed look props (`Pick` of `WaitlistFormProps`, rest spread) and builds `description`/`inputId` from `consentDescriptions`/`consentIds`; all plain data, so it stays a server component. | No change. |
| 5 | Check | All props optional; ui `^0.3.0` already has every prop used (`Checkbox.description`/`id` predate ui 0.3.1). Additive, no version bump; `WaitlistEmailProps` exported from `/ui`. | No change. |
| 6 | Minor | `fieldHintAs`/`fieldHintProps` act on no hint today. | Accepted per the plan review (parity with auth). |

Gates: typecheck, ESLint (zero warnings), language gate, 198 waitlist tests.
