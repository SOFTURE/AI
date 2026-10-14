# Implementation review: security-signed-requests

Scope: full · Date: 2026-10-14 · Commits: 4484bf8..6ce1691 · Gates: typecheck ✓ · lint ✓ (ESLint and language gate) ·
package tests ✓ (157 passed, 7 files) · repository tests ✓ (516 passed, 43 skipped) · build ✓

## Verdict
Ready. `@softure-ai/security` exports `readSmallBodyBytes`, `signRequestBody` and `verifySignedRequest` as issue #469
proposes; the signer and verifier use Web Crypto only and are importable from `@softure-ai/security/signed-request`.
`readSmallBody` behaves as before (its tests are unchanged and green). One finding, accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS (signature checked against `node:crypto` HMAC in a test) | - |
| Tests | PASS (round trip, bytes, rotation both ways, window both ways, five fail-closed secrets, six malformed headers) | - |
| Security | PASS (fail closed, constant-time comparison over every candidate, no secret in errors) | F1 |
| Patterns and lessons | PASS (result values, `RangeError` for programming errors, header parse as in billing) | - |
| Migrations | n/a | - |

## Findings

### F1 [SUGGESTION] A replay inside the window is accepted
**Impact:** LOW · **Dimension:** Security · **Where:** `modules/security/src/signed-request.ts`
**What:** the same signed request verifies again within `toleranceSeconds`. **Why it matters:** an endpoint with a
non-idempotent effect could act twice. **Fix:** out of scope for a pure helper (it would need storage); the README's
Limitations tell the app to deduplicate by a message id. **Decision:** accept (auto).

## Progress audit
- 1.1, 1.2: 4484bf8 moves the streaming into `readCappedBytes`; `readSmallBody` decodes its bytes; new byte tests.
- 2.1 to 2.3: 6ce1691 adds `signed-request.ts`, the error code and message, the root re-export, the `./signed-request`
  export (built to `dist/signed-request.js`), tests, README §4 and the CHANGELOG `Unreleased` section.

## Triage summary
Fixed: -. Accepted: F1. Deferred: -. Withdrawn: -.

## Lessons proposed
none.

## Decisions (auto)
- F1 Replay inside the window → accept (documented in Limitations).
