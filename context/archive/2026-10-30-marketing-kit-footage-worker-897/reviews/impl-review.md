---
change_id: marketing-kit-footage-worker-897
verdict: approved
---

# Implementation review

Reviewed the diff from a27037f against plan.md and issue #897.

- Proposal 1 (async, abort, progress): every spawn of the footage blocks goes through `runProcess`
  (`footage/process.ts`); `probeFile`, `probeFootage`, `normalizeFootage`, `runFfmpeg` and the hyperframes render are
  async. An abort kills the child, removes the partial output (normalized clip, audio, assets, the MP4) and rejects
  with the signal's reason; a stopped normalize leaves no stamp vouching for a partial clip. `onProgress` reports
  `normalize`, `isolate`, `transcribe`, `music`, `assets`, `render` in seconds of media (ffmpeg `-progress pipe:1`,
  hyperframes' percentage) with the item's position. `renderFootageFilm` passes everything through.
- Proposal 2 (estimate in credits): `estimateFootageFilm` probes only, prices each step at the caller's `rates`,
  cached steps at 0; it shares the cache-path helpers with the pipeline (`footage/paid.ts`), so cache keys did not
  change (no re-payment for clips cached by 0.3.1).
- Proposal 3 (`onCharge`): after each paid call, with the provider's `credits` when reported (ElevenLabs'
  `character-cost`) and the cache key. Provider interfaces stay compatible (a plain `Buffer` is still accepted).
- Proposal 4 (`findCachedStep`): no network, no ffmpeg; unknown clips, skipped steps, URL clips not downloaded and
  video-scored music without a cut answer false.
- Proposal 5 (`checkFootageTools`): ffmpeg, ffprobe, hevc and h264 decoders, zscale and tonemap filters, hyperframes
  and its browser (resolved as hyperframes does, without downloading); the CLI runs it before `footage`.
- Proposal 6 (container recipe): `docker/footage-worker.Dockerfile` (shipped in the package), README recipe, CI job
  `footage-image` builds it and runs the footage render tests inside it; a repository test ties the job to the file.
- Tests: process runner (with `node` as the child: output, lines, not started, abort, pre-aborted), ffmpeg listing,
  browser lookup, cache lookup, ElevenLabs credits and signal, render percentage; the opt-in render test runs the
  fixture footage film as a worker (estimate 14 credits, abort at render start leaves no MP4, one charge with the
  fake's 42 credits, normalize progress 12.5 of 12.5 s, cached second run renders without paying). Local run: green.
- Breaking changes are listed in the CHANGELOG under `## Unreleased`; no version bump (batched release).
- Not verified locally: the Docker build (this machine's proxy blocks Debian's mirror); CI's `footage-image` job is
  the check.

Verdict: approved.
