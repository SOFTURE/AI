---
change_id: ci-render-ffmpeg-672
---

# Research: ffmpeg for the marketing-kit render job (issue #672)

## Run history (ci.yml, 30 most recent runs, 2026-10-21 to 2026-10-23)

- Cancelled render jobs: run 39843503224 (master, #661), 39921421008 (PR #668), 39937143209 attempt 1 (PR #671). In
  each one **Install ffmpeg** ran 14m47s to 14m56s and was cancelled at the job's `timeout-minutes: 15`; the browser
  and render steps were skipped. The log of 39921421008 shows apt fetching from `azure.archive.ubuntu.com` at a few
  KB/s (`libavcodec60` 5.8 MB in about 2 minutes, `libflite1` 13.6 MB unfinished after 3 minutes).
- Healthy runs: Install ffmpeg 20 to 33 s, Install hyperframes' Chrome about 5 s, Render the fixture film about 3m30s,
  about 4.5 minutes per job. The job timeout has ample headroom; the variance is all in the apt mirror.
- Other cancelled runs in the window (39823066969, 39809841388) are whole runs cancelled by `concurrency` when a newer
  commit superseded them, which is intended.

## What needs ffmpeg

- `tools/marketing-kit/src/render/preflight.ts` checks `ffmpeg` in `PATH`; `render.ts`, `compose/timeline.ts`,
  `film.ts` and `voice/placeholder.ts` call `ffmpeg` with `libx264`, `libmp3lame` and the `lavfi` `sine` source; the
  render test probes the MP4 with `ffprobe`.
- hyperframes resolves ffmpeg from `PATH` (or `FFMPEG_PATH`) and encodes with libx264 and aac.

## Candidate source

- `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/{ffmpeg,ffprobe}-linux-x64.gz`: versioned
  release assets (each ~29 MB gzip), FFmpeg 6.0 static by johnvansickle.com.
  - SHA-256: ffmpeg `17c1ae10b52ac499180679fe6ba77e17642390c4eedb0f1e3b0ac045da55128f`,
    ffprobe `88ca6818d82a70e87de2bb6166026ad411528c72eda0e4e11ed25d185116ee17`.
  - Encoders present: libx264, libx264rgb, aac, libmp3lame, libopus.
- The workflow already follows this pattern for actionlint (pinned release, published SHA-256, `curl -sSfL`).

## Guards

- `tests/repo/ci-workflows.test.ts` reads the workflows with `yaml` and checks triggers, concurrency and timeouts; a
  check on the render job's install step belongs there. actionlint (with shellcheck) lints the `run:` scripts in CI.
