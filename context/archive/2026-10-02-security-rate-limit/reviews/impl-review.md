# Implementation review: security-rate-limit

Reviewed: phases 1-3 @ 2026-10-02 (an independent read-only reviewer with live probes on PGlite and
PostgreSQL 16 in two time zones, plus the author's check). Verdict: approve after fixes.
Findings: 0 critical, 3 warning, 4 suggestion.

## Drift from plan

None: every Progress item and named test case exists. Probes confirmed the limiter is atomic
(40 parallel consumes with limit 10: exactly 10 allowed on both drivers), Date and integer
parameters bind correctly on PGlite and node-postgres, and no header input yields an
attacker-chosen key or a thrown resolver.

## Findings

### W1 [WARNING] A locked body threw instead of returning body_unreadable
**Where:** `src/read-small-body.ts`
**Decision:** Fix now (applied) - `request.body.locked` is checked with `bodyUsed`; test added.

### W2 [WARNING] A failed cleanup failed the consume call
**Where:** `src/server/rate-limit.ts`
**Problem:** the opportunistic DELETE ran after the attempt was counted; its failure turned a
legitimate request into a 500.
**Decision:** Fix now (applied) - cleanup failures are logged with `errorLogLabel` and do not
change the result; test with a trigger that refuses deletes.

### W3 [WARNING] README §11 promised a retention period cleanup does not guarantee
**Where:** `README.md` §11
**Decision:** Fix now (applied) - says cleanup is probabilistic and how to guarantee retention.

### S1 [SUGGESTION] The window reopened 1 ms after the reported resetAt
**Decision:** Fix now (applied) - expiry is `<=`; test at exactly `resetAt`.

### S2 [SUGGESTION] IPv4-compatible IPv6 (`::a.b.c.d`) shared one /64 key
**Decision:** Fix now (applied) - normalised to IPv4; test added.

### S3 [SUGGESTION] An invalid header name in headerIp threw on every request
**Decision:** Fix now (applied) - validated at construction; test added.

### S4 [SUGGESTION] Invalid UTF-8 was silently replaced
**Decision:** Fix now (applied) - fatal decoding, mapped to `security.body_unreadable`; test added.
