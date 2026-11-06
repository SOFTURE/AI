---
change_id: marketing-kit-footage-failure-kind-1126
status: done
---

# Research

- `FootageResult<T>` is an alias of `TtsResult<T>` (`{ ok: false; error: string }`), used by `pipeline.ts`,
  `draft.ts` and `isolate-ranges.ts`, which build failures with `err` from `voice/provider.ts`.
- Failures inside the result today:
  - loudness gate misses: `finishMix` (silent after the limiter; still out after `attempts` encodes), `finishFootage`
    (the finished file's verdict `fail`);
  - publishability: `finishFootage` (`findFinishProblems`);
  - input: `findFinishVideoProblems`, missing glyphs, `readEdlFile`, no clips, a missing clip or music file, the
    music file type, key terms, `mixLoudness.attempts` 0;
  - process: downloads, hyperframes not started or a non-zero exit, ffprobe of the rendered or finished file, low disk,
    provider calls.
- Outside the result: `runFfmpeg` throws on a failed step; `runProcess` rejects with the signal's reason on abort.
  Both stay as they are (callers already catch them); the README says so, so an app treats a throw as `process` or
  cancelled.
- The CLI (`cli/footage.ts`) prints `error` only; it keeps working unchanged.
