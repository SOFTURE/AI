---
change_id: files-owner-serve-993
verdict: approved
---

# Plan review: files-owner-serve-993

- Covers the three proposals of #993; scope matches change.md (no storage outside the package).
- Compatibility: `serveFileLink` keeps its answer; the existing link tests guard the refactor.
- Security: the owner filter sits in the SQL lookup (`findLiveRow`), so another owner's file, a deleted or expired one
  and a non-uuid id are one 404, indistinguishable from a missing file; the sandbox CSP and `nosniff` stay on every
  answer, so an HTML or SVG file never runs on the app's origin even for its owner. The route reads the session through
  the app's `getOwnerId`, and the README puts the route behind the sign-in guard.
- Missing session answers 404 (as the issue asks) rather than 401: consistent with the one-404 rule.
- Approved without changes.
