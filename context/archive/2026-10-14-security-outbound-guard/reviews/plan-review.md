# Plan review: security-outbound-guard

Reviewed: plan.md @ 2026-10-14. Mode: light. Verdict: ready.
Findings: 0 critical, 0 warning, 1 suggestion.
Grounding: `server/index.ts`, `contract.ts`, `messages/en.ts`, `read-small-body.ts` re-checked; `net.BlockList`
mapped-address behaviour and `URL` literal normalisation checked on Node 22.22.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (both functions, seam and every pitfall listed in #479 have a step and a test) |
| Grounding | PASS |
| Scope | PASS (security only, additive) |
| Risk | PASS (fails closed: unknown input is not public, empty lookup is blocked) |

## Findings
- Suggestion: test that a hostname resolving to one public and one private address is refused, the case the issue
  calls out. Taken into Phase 2's test list.

## Decisions (auto)
- `http:` stays allowed so the loopback seam works; the default port list `[443]` keeps plain HTTP out unless an app
  opts in.
- Mapped IPv4 in IPv6 is refused outright rather than unwrapped: a public target has no reason to be written that way.
