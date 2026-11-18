---
change_id: files-upload-batch-limit
title: "files: one owner may open twenty upload sessions by default, not five"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-9egvqj
created: 2026-11-18
updated: 2026-11-18
---

## Intent

An adopting app's assistant uploads a reel's material in one go: seven phone clips and a cover photo. The sixth
`createUpload` answered `files.too_many_uploads`, because `uploads.maxOpenPerOwner` defaults to 5, and the assistant had
to finish the first five transfers before it could open the rest. A batch of a dozen files from a phone is ordinary;
the default should let it through, while still bounding how many unfinished sessions one owner can keep.

## Scope

- `uploads.maxOpenPerOwner` defaults to 20 (still 1..1000, still configurable).
- A test pins the default: twenty sessions open, the twenty-first is refused, an expired session frees its slot, and
  the per-owner quota still refuses an upload past it.
- README options table, CHANGELOG; a patch release (a loosened default, no API change).

## Out of scope

Queuing sessions past the limit or counting only sessions that received a chunk: both would let one owner keep an
unbounded number of unfinished sessions, and the higher default already covers the batch that failed.

## Notes

Research skipped: the limit is one option read in one place (`createUpload` in `src/server/uploads.ts`); the
expiry and quota rules it sits next to are unchanged. Frame skipped: the observation (the default refuses an ordinary
batch) is the cause.
