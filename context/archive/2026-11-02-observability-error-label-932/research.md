# Research: observability error label (issue #932)

Read: `foundation/observability/src/errors.ts`, `src/logger.ts`, `src/next/index.ts`, their tests,
`foundation/core/src/safe-error.ts`, and Next 16.3.8 in `node_modules/next` (`server/app-render/create-error-handler.js`,
`app-render.js`, `lib/error-telemetry-utils.js`).

## Findings

1. `describeError(error, "label")` returns `exception.type = error.name` and `exception.message =
   errorLogLabel(error)` (core): the name plus a five-character SQLSTATE of the error or its direct cause. A Node
   system code (`ETIMEDOUT`), an undici code (`UND_ERR_CONNECT_TIMEOUT`) or a deeper cause is lost; there is no stack.
2. Next's digest: `createReactServerErrorHandler` sets `err.digest = stringHash(message + stack)` and, when the error
   has a Next error code, appends `@E<n>` (`createDigestWithErrorCode`: `<hash>@E<n>`). Well-known control-flow
   digests (`NEXT_NOT_FOUND`, `NEXT_REDIRECT;…` with a URL, dynamic usage) return early and never reach
   `onRequestError`, but an app can rethrow one, so a digest is logged only when it is a hash.
3. Trace ids: the logger emits through `logs.getLogger(name).emit`, which takes the active context, so a record
   inside a span carries its ids (tested). On the RSC payload path (`generateDynamicFlightRenderResult`) Next creates
   the error handler without a span and calls `onInstrumentationRequestError` while the stream is read, outside the
   request's context: `trace.getActiveSpan()` is undefined there, and `onRequestError` gets no span or trace id in its
   arguments. Nothing in the package can recover the ids; Next does not provide them on that path.
4. V8's `error.stack` is `<name>: <message>\n    at …`. The message can span lines, so frames are only taken after
   the header when the stack starts with exactly `String(error)`'s shape; otherwise none are taken (a changed
   message could otherwise leave text that looks like a frame).
5. `@softure-ai/core` is used by observability only for `errorLogLabel`.

## Options

1. Extend core's `errorLogLabel` and use it: one label everywhere, but a core release and a wider change of a function
   other packages call. Not taken.
2. Build the label in observability (name, safe code, cause chain), add the top app frames as
   `exception.stacktrace`, add `next.digest` and `next.render_source` in `createOnRequestError`, document the trace
   gap. Taken: one package, the issue's scope.
