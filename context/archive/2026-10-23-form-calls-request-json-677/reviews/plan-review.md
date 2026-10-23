---
change_id: form-calls-request-json-677
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and both source files on master.

- Scope covers both asks: both calls move onto `requestJson({ form })`; the range ask is deferred to the core
  release for a reason the repository enforces (release rules), and recorded under Before the next release.
- Behaviour: the outcome table in research.md maps every old branch of `postForm`; the one trap (a 429/5xx with an
  OAuth body) has a test. Stripe keeps `no-store` through a wrapped `fetch` and its log content.
- Security: the client secret and the Stripe key never follow a redirect now (Stripe used to); only zod output of
  the error body is read, so provider free text stays out.
- Public API: unchanged in both packages.

Verdict: approved, no changes.
