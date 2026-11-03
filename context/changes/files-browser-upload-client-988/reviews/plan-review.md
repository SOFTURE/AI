---
change_id: files-browser-upload-client-988
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, the issue and master (a05cf4c).

- Scope: proposal 1 (the sender with the three codes, `HEAD`, missing chunks only, progress, `AbortSignal`) is
  phase 1; proposal 2 (a list for `UploadItem` with add, retry, pause, resume, remove over app callbacks) is phase 2 as
  a controller; proposal 3 (the page reuses the sender) is phase 1. The out-of-scope server parts stay untouched.
- Deviations, accepted: the chunk size is read from the session (an option could only disagree with the server); a
  fourth code for an abort; a controller instead of a hook, with the `useSyncExternalStore` line documented.
- Safety: the page keeps its nonce CSP and `connect-src 'self'`; nothing new is served. The inlined function must not
  close the script element: it holds no `</script>`, and the test runs the page's exact source.
- Watch in implementation: `getItems` must return the same array between changes (React's external store loops
  otherwise); a run settling after a pause must not overwrite the paused state.

Verdict: approved, no changes.
