---
change_id: core-request-error-body-680
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and change.md.

- Scope: every ask of the issue is met. `errorSchema` works on any method; a 4xx, 429 or 5xx answer carries the
  schema's output or `null`; a redirect's body is never read; an unreachable service, a broken-off body, a timeout
  mid-body and a 2xx that fails `schema` give `null` and keep their code; without the option the body is cancelled
  and no `errorBody` key appears (tested on the stream itself).
- Types: one defaulted type parameter per overload; type tests pin `HttpJsonFailure` for calls without the option
  and `HttpJsonErrorBodyFailure<output>` with it. `connections`' wrapper compiles unchanged and does not accept the
  option (out of scope, #677 decides).
- Security: only `safeParse`'s data leaves; a test checks that a value the schema rejects never appears in the
  failure. Fields the schema does not name are stripped (zod's default object behaviour), so a provider's free-text
  `message` stays out unless asked for.
- Gates: typecheck, lint, core and connections tests (642 passing); 18 of the 23 new tests failed on the old code.

Verdict: approved, no changes.
