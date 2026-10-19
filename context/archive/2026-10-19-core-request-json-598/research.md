---
change_id: core-request-json-598
---

# Research: core-request-json-598

## What exists

- `foundation/core/src/result.ts`: `Result<T, E extends ErrorCode>`, `ok`, `err`; `ErrorCode` is `${string}.${string}`.
- `foundation/core/src/safe-error.ts`: `safeError` maps a caught error to `core.database_failed | core.unexpected`
  without its text, the same principle the issue asks for. Copy in `src/messages/en.ts` under `errors.<key>`.
- Failures with extra fields already exist as `Err<Code> & { ... }`: `JobFailure` (jobs), `OpsRefusal` (ops),
  `ImportSignupsRefusal` (waitlist). `HttpJsonFailure` follows that shape.
- No HTTP client in core or the modules; `blog`'s CLI injects `fetch` for tests the same way (`options.fetch ?? fetch`).
- core depends on zod 4 (`z.ZodType<T>`, `safeParse`).

## Platform facts

- `fetch(url, { redirect: "manual" })` in Node 22 (undici) returns the 3xx response itself; in browsers it returns a
  response of `type: "opaqueredirect"` with status 0. Both map to refused.
- `AbortSignal.timeout(ms)` rejects the fetch with a `TimeoutError` DOMException; the body read can also reject when
  the timeout fires mid-body. Both are unreachable.
- A caught fetch error's message can quote the URL (`fetch failed` causes, `Invalid URL "..."`), so it is never read.

## Risks

- Issue #599 edits `index.ts`, README and CHANGELOG of core in parallel: line-level conflicts only.
- Adding keys to `coreMessages.en` widens `CoreMessages`; overrides are `DeepPartial`, so apps are not broken.
