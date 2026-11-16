# Implementation review: llm-stream-chat

- Contract (OK): `streamChat` returns AI SDK's `StreamTextResult` with `recorded`; `toUIMessageStreamResponse()` works
  (test reads the SSE body). One record per chat in every ending (answer, truncation, failure before and during the
  stream, timeout, abort before and after a finished step), guarded by `isSettled`.
- Silent failures (OK): a throwing hook rejects `recorded` (pre-handled) and is recorded on the span; the SDK alone
  would have swallowed it (measured in research).
- Caller callbacks (OK): `onEnd` / `onFinish`, `onStepEnd` / `onStepFinish`, `onAbort`, `onError` are chained after
  the records; `streamRetries` is left out of the request type, so `onError` cannot ask for a retry after the chat was
  recorded.
- Laziness (Suggestion, documented): the answer ends only when the stream is read, so `recorded` and the span wait for
  the consumer; the README says so, and the response is that consumer in a route.
- Types (OK): distributive `Omit` keeps `prompt` / `messages`; `npm run typecheck` passes across the tree;
  `@softure-ai/metering` does not read `outcome`.
- Gates: llm suite 91 passed; ESLint (whole tree) and the language gate clean; repository tests pass.
- Verdict: approve.
