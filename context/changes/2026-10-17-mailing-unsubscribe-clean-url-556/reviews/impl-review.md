---
change_id: mailing-unsubscribe-clean-url-556
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: mailing-unsubscribe-clean-url-556

Checked the diff (`route.ts`, `page-submit.ts`, `actions.ts`, `pages.tsx`, `strip-link-query.tsx`, tests, e2e,
README, CHANGELOG) against change.md, plan.md and the acceptance of issue #556.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Reading the body of every link-less POST on a public, unlimited route lets a client stream a large body into memory. | Fixed: only a URL-encoded body is read, at most 8 KiB, the stream is cancelled past that; a test sends 9 KB. |
| 2 | Check | A one-click POST with a link in the URL never reads the body, so a body link cannot redirect it to another recipient. | Tested ("whatever link the body carries"). |
| 3 | Check | The page outcome logic moved to `page-submit.ts` and is shared by the action and the route; the action's tests pass unchanged. | No change. |
| 4 | Check | `replaceState(history.state, …)` keeps Next's `__NA` marker, so the patched history API passes it through without a router restore (research.md). | No change; e2e checks the address bar and the POST URL in a real build. |
| 5 | Minor | The route's doc said "the body is not read" for every POST. | Reworded: the one-click POST's body is not read. |
| 6 | Check | A database failure brings the link back in the redirect (`?status=failed&r&t`); the strip component removes it again. Same exposure as the mail link's own GET. | Kept, recorded in change.md. |
| 7 | Check | No Polish text, no version bump, no change outside the package and its example app. | No change. |

No Critical findings.
