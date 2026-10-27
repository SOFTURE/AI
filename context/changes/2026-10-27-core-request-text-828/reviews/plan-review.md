---
change_id: core-request-text-828
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (1449291).

- Scope covers every ask of the issue: timeout, redirect following with the final URL, `404/410` as no page, the shared
  status codes with `retryAfterSeconds`, a body cap, `fetch`/`headers`/`clock` options.
- No copy: the cap and chunked read move into helpers that `requestBytes` uses too; status mapping and `Retry-After`
  stay in `http-json.ts`.
- Safety: redirects are opt-in, so a credential header never follows a redirect unless the caller asks; failures carry
  codes only.
- Compatibility: additive; `requestBytes` keeps its tests unchanged, which guards the extraction.
- Gap checked: a redirect loop under `followRedirects` maps to `core.http_unreachable` (fetch throws); a test covers a
  thrown fetch.

Verdict: approved, no changes.
