---
change_id: marketing-kit-music-file-1020
verdict: approved
---

# Implementation review: marketing-kit-music-file-1020

- Matches the plan: optional `fileName` / `contentType` on the file source, a name without an extension counts as no
  name, the video containers join `MUSIC_FILE_TYPES`, the pipeline skips only the type check for a storage key.
- Finding (fixed in ffbc67a): the first version sent a declared name without an extension (an upload called
  `Calm bed`) to the type check, which refused it for lacking a name or a type. The pipeline now checks
  `fileName ?? path` and skips the type check whenever there is neither an extension nor a content type; a test covers
  it, and one more covers a declared name whose content type does not match.
- The new pipeline cases (extensionless `.m4a`, extensionless `.mp4` with sound, the skip log line, declared name and
  type) failed before p2 and pass after it; the render case pins that the music track of a video bed is audio only.
- Compatibility: the new fields are optional; films that passed on 0.5.0 still pass; only previously refused video
  beds and storage keys change outcome. CHANGELOG and README say so.
- Gates: `vitest run tools/marketing-kit tests/repo` green (1500 tests, 73 skipped), typecheck, ESLint and the
  language gate green in the pre-commit hook.
