---
change_id: auth-consent-field-588
reviewed: 2026-10-19
verdict: approved
---

# Plan review: auth-consent-field-588

Checked plan.md against change.md, research.md, issue #588, `auth-forms.tsx` and ui's `CheckboxField` / `Checkbox`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Duplicating `CheckboxField`'s invalid handling in auth can drift from ui. | Accepted: about fifteen lines, and the alternative needs a ui API change and two coordinated releases for one caller. The decision is in change.md. |
| 2 | Check | The server error must still show at the box (no JS path): the box shows the local message first, else `errors.at("consent")`. Tested with `consentProps.id`. | No change. |
| 3 | Minor | `rendered` must list exactly the fields each form renders (register: consent only when `requireConsent`), or a rendered field's error would show twice. | Each form passes its own list; the register test pins one alert with the box hidden and none with it shown (existing test). |
| 4 | Check | All new props are optional; defaults leave markup unchanged (`classNames`/`hintProps` undefined is what the fields get today). Additive, no breaking change. | No change. |
| 5 | Check | No new copy: the message is the existing `errors.auth.consent_required`, overridable per locale. | No change. |

No Critical findings.
