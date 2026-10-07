# Plan review: waitlist-list-adoption

Reviewed: [plan.md](../plan.md) against change.md, issue #214, the waitlist, privacy and mailing sources on master
`88fc13c` and the rules in AGENTS.md. Effort: high (consent evidence, an opt-out written without a link click, a
credential returned to the browser).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical | The adopter's old unsubscribe links carry the sign-up `id` (#214 point 1, #211). Importing the id is not enough: mailing's `legacyUnsubscribe.verify` must turn that id into an address, and the waitlist offers no lookup by id. | Accepted: `getSignupById(ctx, id)` in `/server` (null for a malformed or unknown id); README shows it inside `legacyUnsubscribe.verify`. |
| 2 | Warning | An existing row that is still unconfirmed (a pending double opt-in request) holds requested, not granted, scopes; widening them as if granted would mix the two. | Accepted: an unconfirmed row takes the imported scopes and becomes confirmed at the imported time; its pending link stays and widens the scopes when used, as for any confirmed row. |
| 3 | Warning | Moving `created_at` and `confirmed_at` back separately could break `confirmed_at >= created_at`. | Rejected as a risk: both are moved to the minimum of the stored and the imported value, and each pair already satisfies the order, so the minima do too. A test covers an earlier import on an existing row. |
| 4 | Warning | The opt-out goes through mailing's `unsubscribe`, which runs the app's `onUnsubscribed` hook; an app hook with side effects (a counter) would count imported history. | Accepted as planned, documented in the README: the hook runs as for any unsubscribe. The alternative (an `operator` row) would keep the person suppressed after a new sign-up, which loses a real consent. |
| 5 | Warning | `unsubscribeLinkOnSuccess` gives anyone who types an address its unsubscribe link, also for a known address. | Accepted as planned: off by default, never with double opt-in's `confirmation_sent`, and the README states the trade-off. Returning it only for new addresses would tell new from known, which the module refuses to do. |
| 6 | Suggestion | Equality of the historical time decides idempotency; a JSON time has millisecond precision and `timestamptz` keeps microseconds, so a value written elsewhere with microseconds would never match. | Accepted as planned: imported times come from the file (milliseconds) and are stored as given, so a re-run of the same file matches. Noted in the README. |
| 7 | Suggestion | `onJoined` is not called on import, so an analytics funnel misses imported history. | Accepted as planned (the issue allows documenting it): `countSignupsByChannel` gives the per-channel counts of the list, imported rows included. |

No open findings. Verdict: ready to implement.
