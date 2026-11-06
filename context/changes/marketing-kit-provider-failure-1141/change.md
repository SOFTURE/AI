---
change_id: marketing-kit-provider-failure-1141
title: "marketing-kit: provider failures carry structured details (issue #1141)"
status: review_ready
roadmap_item: null
issue: 1141
branch: claude/project-thread-aojd1w
created: 2026-11-06
updated: 2026-11-06
---

## Intent

Close [issue #1141](https://github.com/SOFTURE/AI/issues/1141): the ElevenLabs footage providers (speech to text,
voice isolation, music) answer every failure as one sentence, so an app cannot log a safe reason and
`isolateSpeechRanges` asks a deterministic refusal (a 400 `audio_too_short`) three times. A provider failure gets a
structured `providerFailure` (`kind`, `status`, `code`, `message`, `requestId`, `isRetryable`), the retry loop asks
again only when it is retryable, and the footage pipeline passes it on.

## Context

Labels: `pkg: marketing-kit`. Builds on #1126 (`FootageFailure`, PR #1133) and #1127 (range retries), both in
0.15.0. No version bump here: the fix joins the next combined marketing-kit release.

## Constraints

- `error` keeps its sentences; `providerFailure` is optional on `TtsResult`, so custom providers still compile.
- The fields carry no key, path, transcript or audio content.

## Notes

- Framing: skipped. The issue names the need and the shape.
