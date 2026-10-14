---
change_id: llm-package
title: "llm: a new package @softure-ai/llm with schema-validated generation, timeouts, stable error codes, usage and cost records, and a fake model (issue #472)"
status: archived
roadmap_item: null
issue: 472
branch: claude/project-thread-umylap
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

An app that scores or summarises user content with a language model installs `@softure-ai/llm` instead of wiring the
AI SDK by hand. It passes the model it already built with an AI SDK provider (OpenRouter, OpenAI, Anthropic, …) and
gets `generateStructured({ schema, system, prompt, timeoutMs })`: the output validated by a zod schema, a timeout, and
a `Result` whose failures are stable codes (`llm.unavailable`, `llm.invalid_output`, `llm.timeout`). Every call
reports its token usage and its cost (from the app's price table) to an `onUsage` hook, so a billing or quota module
can count calls per account, and emits an OpenTelemetry span. `fakeModel()` from `@softure-ai/llm/testing` returns
fixed objects or failures in tests.

A reviewer checks `foundation/llm/` (sources, tests, README, CHANGELOG) and the root lockfile.

## Context

Issue [#472](https://github.com/SOFTURE/AI/issues/472) (labels `enhancement`, `new package`): no package wraps a
language model call; an adopting app uses the AI SDK with the OpenRouter provider directly inside its own module. The
owner accepted the package on 2026-10-14 with a narrowed scope: the model comes from the app (built with an AI SDK
provider), so the package has no provider layer of its own and no `openrouter()` in `softure.config.ts`.

## Constraints

- A workspace package under `foundation/` (a server library with no tables, routes or copy, like `observability`),
  passing `tests/repo/packages.test.ts` and the release rules; version 0.1.0, CHANGELOG `## Unreleased`.
- `ai` (the AI SDK, major 7) and `zod` 4 are peer dependencies: the app owns the SDK version its providers match.
- No prompt or output text in spans or usage records (they may hold personal data).
- English only.

## Notes

- Framing: skipped; the issue and the owner's narrowed scope state the problem and the solution space.
- Archived 2026-10-14: `@softure-ai/llm` exists with structured output, error codes, usage records, spans and a fake
  model; it ships with the next release.

## Decisions (auto)

- **Name and error codes.** The package is `@softure-ai/llm` and its codes are `llm.*` (the issue sketched `ai.*`):
  codes are namespaced by the package that raises them, and `ai` is the AI SDK's own package name.
- **No database table for usage.** Usage goes to an `onUsage` hook the app supplies (the issue's "usage accounting
  hook"); persisting it is the app's or a quota module's job. Smallest thing that meets the intent.
- **Placement in `foundation/`**, not `modules/`: no routes, tables, copy or `softure.config.ts` entry; it is a
  library a module or an app calls, like `observability`.
