# Implementation review: security-outbound-guard

Reviewed: branch claude/project-thread-egsklk against plan.md @ 2026-10-14. Mode: light. Verdict: pass.
Findings: 0 critical, 1 warning (fixed), 0 suggestions.

## Lenses
| Lens | Result |
| --- | --- |
| Plan fidelity | PASS (both functions, seam, codes, README and CHANGELOG as planned) |
| Correctness | PASS after fix |
| Security | PASS (fails closed: non-address input, empty lookup, any non-public address, mapped IPv4) |
| Tests | PASS (both lookup shapes exercised for real; `all` confirmed by probing `net.connect`) |

## Findings
- Warning (fixed): a synchronous throw from the transport (a header with a line break) reached `settle` before the
  timer was declared, a `ReferenceError` instead of `security.outbound_failed`. The timer now starts before the
  request; a test sends such a header and failed before the fix.

## Decisions (auto)
- A port outside `allowedPorts` is `security.outbound_blocked` (a policy refusal), credentials in the URL are
  `security.outbound_invalid_url`.
- The seam takes `resolveHost` besides `request` and `isAllowedAddress`, so tests cover the lookup without DNS.
