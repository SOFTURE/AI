# Plan review: mailing-unsubscribe

Reviewed: plan.md @ 2026-10-03 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warnings, 1 suggestion.

## Findings

### W1 [WARNING] EN-4 runs in parallel and sends transactional mail through the same sendMail
**Where:** Approach, kinds and database handle
**Problem:** a required `kind` or a required `db` in `MailContext` would break EN-4's reset sender.
**Decision:** Fix now (applied) - `kind` defaults to `transactional`, `db` is optional and only list
mail needs it; the `/next` adapter opens the database for list mail only.

### W2 [WARNING] A per-IP rate limit would refuse real one-click unsubscribes
**Where:** Phase 2, one-click route
**Problem:** the repository rule says public endpoints are rate-limited, but mail providers post
from a few shared addresses.
**Decision:** Fix now (applied) - no bucket; the route validates shape and signature before any
database access, writes idempotently, and the exception is written down in research and README.

### S1 [SUGGESTION] Per-list preferences
**Decision:** Defer - global suppression is the safe reading of RFC 8058; per-list preferences can
come as an opt-in table without changing the link.
