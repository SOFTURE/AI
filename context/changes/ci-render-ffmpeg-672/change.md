---
change_id: ci-render-ffmpeg-672
title: "ci: the marketing-kit render job installs ffmpeg without apt (issue #672)"
status: planned
roadmap_item: null
issue: 672
branch: claude/project-thread-h45fkw
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #672](https://github.com/SOFTURE/AI/issues/672). The `marketing-kit fixture film render` job in `ci.yml`
is cancelled at its 15-minute timeout on unrelated pull requests and master pushes. Every cancelled run hangs in the
**Install ffmpeg** step, where `apt-get` downloads ~60 packages from the runner's Ubuntu mirror at a few KB/s; the
render itself takes about 3.5 minutes.

## Context

Labels: `bug`, `pkg: marketing-kit`. CI only: the render test, its assertions and the job timeout stay as they are. No
package code changes, no version bump.

## Acceptance

- The render job installs ffmpeg and ffprobe without apt, from pinned builds checked against a pinned SHA-256.
- The install step has its own short timeout, so a slow download fails fast under its own name.
- A repository test guards both, and fails on the current workflow.
- The render job passes on the pull request.

## Notes

- Framing: skipped. The issue states the problem with measured run data.

## Decisions (auto)

- Static builds from the `b6.0` release of `eugeneware/ffmpeg-static` (FFmpeg 6.0 by johnvansickle.com, the same
  binaries the `ffmpeg-static` npm package ships): a fixed, versioned GitHub release asset per tool, served from
  GitHub's CDN, with the encoders marketing-kit and hyperframes use (libx264, aac, libmp3lame). Rejected: caching the
  apt packages (still needs `apt-get update` from the same mirror, and a third-party action), a rolling build such as
  BtbN's `latest` (its checksum changes), an npm dependency (every `npm ci` would download ~60 MB of binaries).
- No `actions/cache`: two ~29 MB downloads from GitHub take seconds; a cache adds a moving part for no measured gain.
