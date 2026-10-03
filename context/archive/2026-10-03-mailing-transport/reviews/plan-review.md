# Plan review: mailing-transport

Reviewed: plan.md @ 2026-10-03 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warnings, 1 suggestion.

## Findings

### W1 [WARNING] A provider that ignores the abort signal would hang the request
**Where:** Approach, timeout
**Problem:** handing a signal to the provider is not enough; a third-party adapter may never read it.
**Decision:** Fix now (applied) - `sendMail` races the provider against its own timer and answers
`mailing.unavailable` when the timer wins; a test uses a provider that never settles.

### W2 [WARNING] The fake provider could drop production mail silently
**Where:** Phase 1, fake provider
**Problem:** an app that forgets to switch providers would "send" into memory in production.
**Decision:** Fix now (applied) - without an outbox file the fake answers `unavailable` and logs
under `NODE_ENV=production`; the example sets an outbox file only for the e2e.

### S1 [SUGGESTION] A per-mail reply-to override
**Decision:** Defer - the roadmap asks for sender and reply-to from config; a contact form that
needs a per-mail reply-to can come with its own item without breaking the contract (an optional field).
