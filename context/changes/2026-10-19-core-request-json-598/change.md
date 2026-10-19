---
change_id: core-request-json-598
title: "core: requestJson, a JSON GET for external APIs that returns a Result with failure codes (issue #598)"
status: planned
roadmap_item: null
issue: 598
branch: claude/project-thread-9tfiaa
created: 2026-10-19
updated: 2026-10-19
---

## Intent

Close [issue #598](https://github.com/SOFTURE/AI/issues/598): an adopting app wrote the same request helper for two
third-party JSON APIs twice. `@softure-ai/core` gets one function that does the easy-to-miss parts once: a timeout,
no redirects followed, every failure returned as a code that never carries the URL or the caught error's text, the
status mapped to a small closed set of outcomes, and the body narrowed by an optional zod schema. A `toQueryString`
helper builds the query part of the URL.

## Context

Labels: `enhancement`, `pkg: core`. core 0.2.0 is the latest on npm and on master. Releases are batched by the
coordinator: no version bump here, the CHANGELOG gets `## Unreleased`. Issue #599 adds calendar periods to core in a
parallel thread (`index.ts`, README, CHANGELOG); master is merged in before the merge.

## Acceptance

- `requestJson({ url, fetch?, headers?, timeoutMs?, schema? })` from `@softure-ai/core` returns
  `Promise<Result<T, HttpJsonFailureCode> | HttpJsonFailure>`: `Ok` with the parsed body (`unknown` without a schema,
  the schema's output with one) or an `HttpJsonFailure`.
- `HttpJsonFailure` is `Err<HttpJsonFailureCode>` plus `status: number | null`; the codes are a closed union:
  `core.http_unreachable` (network error, timeout), `core.http_refused` (3xx, opaque redirect, 401, 403),
  `core.http_rate_limited` (429), `core.http_unavailable` (5xx), `core.http_unexpected_answer` (any other status,
  a body that is not JSON, a body that fails the schema).
- The request is a GET with `redirect: "manual"`, `Accept: application/json` unless the caller sets it, and
  `AbortSignal.timeout(timeoutMs)`; `fetch` is injectable.
- No failure value contains the URL, a header value or the caught error's message.
- `toQueryString(record)` encodes scalar values, skips `null` and `undefined`.
- English copy for the five codes in `coreMessages`; README and CHANGELOG document it with the app migration.

## Notes

- Framing: skipped. The issue states the problem and a concrete proposal.

## Decisions (auto)

- Codes are namespaced `core.http_*`, because `ErrorCode` is `<module>.<code>` and apps already switch on core's
  codes; the issue's short names map one to one.
- The status rides on the failure (`Err & { status }`, the shape `JobFailure` and `OpsRefusal` use), `null` when no
  response arrived; the result type stays a `Result` so `ok`/`error` narrowing works as everywhere else.
- A timeout is `core.http_unreachable` with no separate code: the caller's response is the same (retry later).
- Statuses the issue does not name (404, 400, 1xx-free odd codes) are `core.http_unexpected_answer` with the status.
- `fetch` defaults to `globalThis.fetch` and `timeoutMs` to 10 000: an app passes neither unless it needs to.
- Root entry, not a new `core/server` entry: `fetch` and `AbortSignal.timeout` run on Node 22 and in the browser.
