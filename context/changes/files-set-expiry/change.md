---
change_id: files-set-expiry
title: "files: setFileExpiry changes a stored file's expiry after it was saved"
status: impl_reviewed
roadmap_item: null
issue: null
branch: claude/project-thread-9x1bfc
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Let an app change how long a stored file lives after it was saved. An adopting app keeps a clip for good once it
learns, after the upload, that the clip is worth keeping (and lets it go sooner when it is not); today the expiry is
fixed at save time and the only way to change it is writing to the package's table.

## Context

`@softure-ai/files` 0.5.3: `saveFile` and `finalizeUpload` set `expiresAt` from `expiresAt`, `ttlSeconds` or
`defaultTtlSeconds`; `pruneFiles` removes a file once `expires_at <= now`. No function changes it later.

## Scope

- `setFileExpiry(ctx, fileId, { ownerId?, expiresAt: Date | null })` in `./server`, answering the updated `StoredFile`
  or `files.not_found`.
- Tests, README, CHANGELOG; a minor release (0.6.0).

## Constraints

- Only a live file changes: a deleted or expired file stays gone (an expired one may already be half pruned).
- Additive: no existing behaviour or schema changes.

## Notes

- Research and frame skipped: one additive function over an existing column, with `deleteFile` as the in-package
  precedent for the owner filter and the live check.

## Done

- `setFileExpiry` in files 0.6.0 (released after the merge by the release run).

## Decisions (auto)

- A past date is accepted (the file stops being served at once and the next prune removes it): it is the caller's way
  to let a file go on the prune's schedule rather than deleting it now.
- No MCP tool: the change is for app code; nothing an assistant asks for.
