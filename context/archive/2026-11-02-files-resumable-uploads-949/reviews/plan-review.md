---
change_id: files-resumable-uploads-949
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, the issue and master (c9380e5).

- Scope: every numbered proposal of the issue is covered: sessions (1), `createUpload` with limits (2), chunked and
  resumable route with `HEAD`, the single-request case, streaming, the rate limit and both drivers (3), idempotent
  `finalizeUpload` with size and sha256 checks (4), MCP helpers with a `curl` loop and the page as fallback (5), the
  browser page (6), prune (7), the bypass docs (8).
- Deviation, accepted: the state is derived rather than a column, and S3 gets its multipart through `saveFile` at
  finalize instead of one multipart upload per session. Both are recorded with reasons.
- Safety: the token is verified before any query; a received part is immutable, so finalize cannot read a part being
  rewritten; a parallel finalize keeps one file. The page needs a CSP nonce because the route's other answers are
  user content-free JSON or headers.
- Compatibility: additive migration, optional peer, new optional route; `PruneFilesReport` and `FilesUserData` gain
  fields, which is additive for apps (tests that compare them whole are updated).
- Watch in implementation: keys of parts must match the local driver's key pattern; the `PUT` must not read the body
  of a chunk it refuses up front.

Verdict: approved, no changes.
