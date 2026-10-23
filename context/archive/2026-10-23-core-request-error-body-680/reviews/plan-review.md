---
change_id: core-request-error-body-680
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `http-json.ts` on master.

- Scope matches every ask of the issue: opt-in option on any method, `errorBody` for 4xx/429/5xx, `null` for an
  empty, non-JSON or invalid body, for a redirect, an unreachable service and a broken-off body; unchanged without
  the option; only the schema's output leaves; the timeout bounds the read.
- Compatibility: the overloads gain a defaulted type parameter; a call without `errorSchema` infers the default and
  keeps `HttpJsonFailure`. The plan has a type test for it. `connections`' wrapper keeps its own overloads and is
  unaffected.
- Security: the raw body and the schema's issues never leave; a redirect body is never read (it may come from
  another host's content).
- Edge cases: 401/403 are refusals but still 4xx, so their bodies are read (needed for `invalid_client`); 409/412,
  429 with `Retry-After`, `readHeaders` together with `errorSchema`.

Verdict: approved, no changes.
