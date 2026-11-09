---
change_id: guarded-file-download
title: "security: downloadGuardedFile, a streamed SSRF-guarded file download"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-gybbbf
created: 2026-11-09
updated: 2026-11-09
archived_at: 2026-11-09
---

## Intent

An adopting app lets a user hand over a file by its public URL (a video or an image for a media pipeline) instead of
uploading it. The server must fetch it itself without SSRF exposure and without holding a file of up to several GiB in
memory. `fetchGuardedPage` holds the guard but buffers the body. Add `downloadGuardedFile`: the same guard on every
hop, the body streamed to a caller's `consume` (e.g. `@softure-ai/files` `saveFile`), a byte cap after
decompression, one time limit, and an optional https-only rule.

## Constraints

- `fetchGuardedPage` behaves exactly as before (its tests stay unchanged and green).
- No real network in tests: a fake server on loopback through the existing seam.

## Notes

- Research: skipped. The guard, its seam and the page fetch it reuses are in this package; the need is fully
  described above.
- Framing: skipped, same reason.
