# Plan review: llm-stream-chat

- Compatibility (Warning, accepted): `UsageRecord.outcome` and `LlmCallRecord.outcome` widen by `llm.aborted`, and
  `operation` by `streamChat`. Code that switches exhaustively over them gets a compile error; readers that compare
  against `"ok"` are unaffected. Minor bump at the batch release, CHANGELOG says so.
- Silent hook failures (Warning, accepted): the SDK swallows a throw in `onEnd`; the plan's `recorded` promise plus
  the span exception cover it. The README must tell routes to hand `recorded` to `after()` / `waitUntil`.
- Abort usage (Suggestion, accepted): the unfinished step's tokens are unknown; say so in the README and in the
  metering recipe instead of estimating.
- Type of the request (Suggestion, accepted): use a distributive `Omit` so `prompt` / `messages` survive; keep the
  tool-set generic so `toUIMessageStreamResponse<ChatMessage>()` types stay intact.
- Verdict: approve.
