---
change_id: speech-transcription-956
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (5bf47dc).

- Scope: all seven proposals of the issue are covered (contract and codes, three adapters, ffmpeg normalization and
  chunking, output helpers, usage hook, fake, worker image note). The one deviation, the `ctx` argument, is recorded
  with its reason; the extra `speech.unavailable` code keeps network and 5xx failures apart from refusals.
- Safety: keys come from options or the environment and never reach a log or an error; `requestJson` follows no
  redirects and drops error texts that could quote a URL. ffmpeg runs through `spawn` with an argument list (no
  shell), on files in a private temp folder that is removed on every path.
- Resource bounds: the decode is capped at the length limit plus one second, chunks are read one at a time, and the
  chunk length keeps a FLAC chunk under the 25 MB upload limit.
- Tests: CI has no ffmpeg in the test job, so the normalizer's logic is tested through the injected runner and the
  real binary is exercised where present. No test touches the network.
- Compatibility: a new package at `0.0.0`; nothing else changes behaviour.

Verdict: approved, no changes.
