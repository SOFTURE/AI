---
change_id: speech-transcription-956
title: "speech: a new package that turns audio into text through a provider, with normalization, chunking, subtitles and cost (issue #956)"
status: implementing
roadmap_item: null
issue: 956
branch: claude/project-thread-m66igp
created: 2026-11-02
updated: 2026-11-02
archived_at: null
---

## Intent

Close [issue #956](https://github.com/SOFTURE/AI/issues/956). An app that needs a transcript (a note taken from a short
video, voice notes, subtitles for clips) gets it from `@softure-ai/speech` instead of wiring a Whisper API, ffmpeg and
cost accounting itself: one `Transcriber` with stable failure codes, Groq, OpenAI and OpenAI-compatible adapters, input
normalization and chunking through ffmpeg, SRT/VTT/paragraph helpers, a usage record per call and a fake for tests.

## Context

Labels: `enhancement`. The owner approved the new package (2026-11-02). Its worker needs ffmpeg in the image, which
#948 made possible (a worker image of its own, on master since 5bf47dc). No release in this change: the package starts
at `0.0.0` with `## Unreleased`, and the coordinator publishes it first in the next combined release.

## Constraints

- Owns `foundation/speech/` and the root `README.md` layout line only.
- No change to `@softure-ai/llm` or `@softure-ai/jobs`; no change in any app repository.
- English only; no network or ffmpeg needed by the default test run (the ffmpeg test runs only where ffmpeg exists).

## Notes

- Framing: skipped. The issue names the problem and the solution for every part.
