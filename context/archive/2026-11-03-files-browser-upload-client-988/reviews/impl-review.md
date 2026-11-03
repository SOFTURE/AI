---
change_id: files-browser-upload-client-988
verdict: approved
---

# Implementation review

Reviewed the diff of a9349ec and bd90407 against change.md, plan.md and the issue.

- Acceptance, per proposal of the issue: `sendUpload` (1) reads `HEAD`, sends only the missing chunks in order with
  `Content-Range`, reports `{ sentBytes, totalBytes }`, honours an `AbortSignal` and answers a `Result` with the three
  codes plus `files.upload_aborted`; tested against the real route (full send, resume, finalized session, expiry, size
  mismatch, refused chunks, `429`/`5xx`, a thrown fetch, abort). `createUploadQueue` (2) keeps items theme-notion's
  `UploadFileItem` takes as they are, with `add`, `retry`, `pause`, `resume`, `remove`, `getItems`, `subscribe`;
  tested for concurrency, a stable snapshot, pause and resume without a resent chunk, remove, failed open, send and
  finalize, a retry in the same session, a new session after expiry, a thrown finalize. The page (3) inlines
  `sendUpload.toString()`; a test runs the page's exact inlined source on its own against the route, and the built
  `dist/` function was run in a fresh `vm` context the same way.
- Finding, fixed: a session opened while its item was paused was dropped, so the resume opened a second session (an
  orphan until `files.prune`). The queue now keeps it; a test covers it.
- Safety: the page keeps its nonce CSP and `connect-src 'self'`; the inlined source holds no `</script>`. The client
  entry imports only types from core and the pure message dictionary.
- Out of scope, kept: no server-side cancel on `remove` (the package has none; the session expires).

Verdict: approved after the fix.
