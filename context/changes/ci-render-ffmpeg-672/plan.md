---
change_id: ci-render-ffmpeg-672
status: planned
---

# Plan: ffmpeg without apt in the marketing-kit render job (issue #672)

Input: change.md, research.md. Complexity: small (one workflow step, one repository test, one README sentence).

## Goal

The render job no longer depends on the runner's Ubuntu mirror, so it finishes in about 4.5 minutes every time and a
slow download fails fast under its own step name.

## Approach

Replace the apt install with a download of the pinned static ffmpeg and ffprobe from a GitHub release, verified with
`sha256sum -c`, unpacked into `$RUNNER_TEMP/ffmpeg/bin` and put first on `PATH` through `$GITHUB_PATH`. The step gets
`timeout-minutes: 3`. Rejected alternatives are listed in change.md under `## Decisions (auto)`.

## Phase 1: repository test (fails first)

Files: `tests/repo/ci-workflows.test.ts`.

1. `describe("ci.yml")`: the render job's "Install ffmpeg" step has its own `timeout-minutes` below the job's, runs
   no `apt-get`, downloads from a pinned versioned release URL and checks a 64-hex SHA-256 for both ffmpeg and ffprobe.
2. Run it: it fails on the current workflow.

## Phase 2: the workflow step and the README

Files: `.github/workflows/ci.yml`, `tools/marketing-kit/README.md`.

1. ci.yml: the new "Install ffmpeg" step (env: release URL, two SHA-256 values; `curl -sSfL --retry 3`, `sha256sum -c`,
   `gunzip`, `chmod +x`, `$GITHUB_PATH`, print `ffmpeg -version`), a comment saying why (issue #672).
2. README "Development": CI installs ffmpeg from a pinned static build.
3. Gates: the repository test passes; the step's script runs locally against the real release (download, checksum,
   version); the render test passes locally with that ffmpeg first on `PATH`; actionlint runs on the PR.

## Risks and rollback

- The release asset could disappear: the step then fails fast (3 minutes) with a curl error naming the URL. Rollback is
  reverting the commit (back to apt).
- FFmpeg 6.0 instead of Ubuntu's 6.1.1: the encoders used are present; the local render test confirms the output.

## Progress

- [ ] Phase 1: repository test (fails first)
- [ ] Phase 2: the workflow step and the README
