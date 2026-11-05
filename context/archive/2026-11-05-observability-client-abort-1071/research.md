---
change_id: observability-client-abort-1071
---

# Research

## Code (master 211422f)

- `foundation/observability/src/next/index.ts`: `createOnRequestError(logger)` calls `logger.error("request
  failed", { error, http.request.method, url.path, next.route, next.route_type, next.router_kind,
  next.render_source, next.digest })` for every error. No option argument today.
- `Logger` (`src/logger.ts`) has `debug`, `info`, `warn`, `error`; `errorDetails: "label"` changes only what is
  logged, never the error object, so recognising by message works under every `errorDetails`.
- Tests: `tests/next.test.ts` → `describe("createOnRequestError")` with an `InMemoryLogRecordExporter`.

## What a client's abort looks like

- React's `pipe` (Fizz and Flight on Node) adds a `close` listener to the destination that aborts the render with
  `Error("The destination stream closed early.")`; Next.js reports it through `onRequestError` (the issue's stack
  `at PassThrough.<anonymous>` / `PassThrough.emit`, reproduced with `renderToPipeableStream`).
- Node's `stream.finished` / `pipeline` reject with `code: "ERR_STREAM_PREMATURE_CLOSE"`
  (`Premature close`).
- Next.js's `ResponseAborted` (`next/dist/server/web/spec-extension/adapters/next-request`): `class ResponseAborted
  extends Error { name = "ResponseAborted" }`, thrown when the response's abort signal fires.
- Node's `http` server request: `Error("aborted")` with `code: "ECONNRESET"` when the socket closes mid-body.

## Options

1. A predicate in the package plus an `isClientAbort` option that replaces it (an app composes it with the exported
   default or passes `() => false` to turn it off). Simple, covers extend and off.
2. Also a `clientAbortLevel` option. Not asked for by any evidence; left out.

Recommendation: option 1.
