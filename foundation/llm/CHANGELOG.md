# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/llm`. When an app has run a version
in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.1.0

- First version (#472): `createLlm({ model, pricing, onUsage, timeoutMs, maxRetries })` over an AI SDK 7 model the
  app builds, `generateStructured({ schema, system, prompt })` returning a `Result` with the zod-validated output, the
  token usage and the cost, or `llm.unavailable` / `llm.invalid_output` / `llm.timeout`; an `onUsage` record per call
  for quotas and billing; an OpenTelemetry span per call; `fakeModel()` from `@softure-ai/llm/testing`.
