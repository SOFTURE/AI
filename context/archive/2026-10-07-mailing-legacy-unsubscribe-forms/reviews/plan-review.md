---
change_id: mailing-legacy-unsubscribe-forms
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: mailing-legacy-unsubscribe-forms

Checked `plan.md` against `change.md`, the issue, `readUnsubscribeLink`, `getUnsubscribeLinkParams`, `unsubscribe`,
the one-click route, the unsubscribe page and action (`src/next/pages.tsx`, `src/next/actions.ts`) and the
options schema.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The page sends the link back as hidden fields via `getUnsubscribeLinkParams`; an optional name missing from the link must not become an empty hidden field, or the form post would differ from the link. | Accepted: `values` only carries names that were present, and `getUnsubscribeLinkParams` copies `values`; a test reads a bare-token link back through it. |
| 2 | Warning | A 200 for an invalid link also applies to signed links; an app might expect the option to be legacy-only. | Accepted as designed: the oracle is the same for signed links. Named `oneClickInvalidLinkStatus` at the top level and documented as route-wide. |
| 3 | Suggestion | `verify`'s type could take `Partial` values for optional names. | Rejected: the record type is already `Record<string, string>`; reading an absent optional name gives `undefined` under `noUncheckedIndexedAccess`. README says optional names may be absent. |
| 4 | Suggestion | The waitlist's `withdrawWaitlistConsents` hook is typed as `OnUnsubscribedHook`; an added field must not break it. | Checked: it reads `recipientKey` only; adding `link` is compatible. |

No finding blocks the plan.
