---
change_id: mailing-unsubscribe-clean-url-556
reviewed: 2026-10-17
verdict: approved
---

# Plan review: mailing-unsubscribe-clean-url-556

Checked plan.md against change.md, research.md, issue #556, `route.ts`, `actions.ts` and `pages.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The route has no Origin check (server actions do). | No new exposure: the one-click POST already accepts any origin, and the signature is the authorization. Record it in the route's comment. |
| 2 | Minor | `request.formData()` throws on a body that is not a form (e.g. JSON, or a mail client's odd content type). | Catch and treat as no link (400), never 500. Test it. |
| 3 | Minor | The one-click POST must not start reading bodies: a URL link wins whatever the body carries. | Test with a URL link plus a body link for another recipient: the URL's recipient is recorded. |
| 4 | Check | The legacy link's names come from `getUnsubscribeLinkParams`, so the strip component also removes legacy params. | No change. |
| 5 | Check | `same-origin` referrer and "opening changes nothing" are untouched. | No change. |

No Critical findings.
