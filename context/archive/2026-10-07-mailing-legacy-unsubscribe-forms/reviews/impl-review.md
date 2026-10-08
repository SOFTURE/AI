---
change_id: mailing-legacy-unsubscribe-forms
reviewed: f8616e3
date: 2026-10-07
verdict: approved with fixes applied
---

# Implementation review: mailing-legacy-unsubscribe-forms

Checked the diff against `plan.md`, `change.md` and the three points of issue #211; read every caller of
`readUnsubscribeLink`, `getUnsubscribeLinkParams` and `unsubscribe` (the page, its action, the one-click route) and
every `OnUnsubscribedHook` in the repository (the waitlist's `withdrawWaitlistConsents`).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `UnsubscribeEvent.link` is a new required field: code that builds an event by hand (the waitlist's tests) no longer type-checks. Hooks themselves are unaffected. | Accepted: the field is required so a hook can rely on it; the waitlist tests pass `link: { scheme: "signed" }`. Named in the CHANGELOG. |
| 2 | Warning | The CHANGELOG had no entry for the new options. | Fixed: an `Unreleased` section (the repository test only allows that or the current version), renamed at release. |
| 3 | Suggestion | The `{ required, optional }` refusals report at `options.legacyUnsubscribe.params`, not at the inner list. | No change: the message names the rule (`must not repeat a name`, `must name at most 8 parameters`), which is enough to fix the config. |
| 4 | Suggestion | With `oneClickInvalidLinkStatus: 200`, a mail client's POST with no parameters also gets 200. | As designed: no parameters is one more "link that does not verify"; a test covers it. |

Plan drift: none. Tests: new cases were red before the implementation (19 failing) and pass after; mailing and
waitlist suites 506/506; typecheck, ESLint and the language gate clean. The README example type-checked in a
scratch test against the package (removed after the run).
