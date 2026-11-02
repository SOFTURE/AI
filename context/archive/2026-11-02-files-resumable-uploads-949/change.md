---
change_id: files-resumable-uploads-949
title: "files: resumable uploads through signed URLs and MCP upload tools (issue #949)"
status: archived
roadmap_item: null
issue: 949
branch: claude/project-thread-4343nf
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
---

## Intent

Close [issue #949](https://github.com/SOFTURE/AI/issues/949): `@softure-ai/files` can store a stream the server
already has, but nothing takes a large file from a client. Add upload sessions with a signed, token-protected upload
URL that takes the file in chunks under a proxy's body limit and resumes after a dropped connection, a
`finalizeUpload` that turns the chunks into a stored file, a browser fallback page, cleanup in `files.prune`, and MCP
helpers (`create_upload`, `finalize_upload`) so an assistant sends the bytes from its own sandbox instead of through a
tool call.

## Context

Labels: `enhancement`, `pkg: files`, `pkg: mcp-access`, `status: in progress`. No release in this change: the
coordinator releases in the next combined release (CHANGELOG `## Unreleased`). Issues #953, #961 (and later #952) touch
`mcp-access` in parallel; issue #950 (an upload field in theme-notion) builds on this API.

## Constraints

- Nothing changes for an app that does not mount the upload route: the new table is additive, `saveFile`, links and
  the link route behave as before.
- Bytes are streamed, never buffered; each request stays under the chunk size.
- Works on every storage driver through the existing `FileStorage` contract (local, S3, memory).
- The upload URL is the only secret the client needs; it is checked before any database read.
- English only in the repository.

## Notes

- Framing: skipped. The issue names the problem, the shape of the API and the constraints.
