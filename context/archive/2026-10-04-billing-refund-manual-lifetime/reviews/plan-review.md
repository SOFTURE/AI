# Plan review: billing-refund-manual-lifetime

Reviewed: plan.md, research.md against `src/server/{payments,grants,take-back,plans}.ts` and
`README.md` §6, §12. Verdict: **approved**, no blocking findings.

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | Yes: step 1 changes the only refund path that asks `hasOtherLifetime`; step 2 proves it on PGlite. |
| Lock order | Unchanged: account (key share) → `lockEntitlementRow` → payment row; the new read is a select under the entitlement lock that every manual grant writer also takes first. |
| Partial refunds (FU-20) | Unaffected: `getTakeBackEvent` returns before `hasOtherLifetime` for a partial share of a lifetime. |
| Revoked grants | Not counted (`status = 'active'`), matching the revoke path; step 2 has the revoke-then-refund case and the existing grants test keeps it. |
| Test first | Step 2 runs the new test before step 1's code is in place. |
| Docs | README §6 and §12 named; the payments module header names no lifetime rule, nothing to change there. |
| Scope | No migration, no FU-22 work, no new export. |

## Findings

- F1 (minor, accepted into step 2): the recorded lifetime payment on an account that already has
  manual lifetime must store `grant_kind = 'lifetime'`, or the refund would take the "no grant"
  path (revoke paid access). Assert the stored grant in the test rather than assume it.
