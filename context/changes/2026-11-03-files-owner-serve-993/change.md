---
change_id: files-owner-serve-993
title: "files: serve a stored file to its signed-in owner, with ranges and no public link (issue #993)"
status: implementing
roadmap_item: null
issue: [993]
branch: claude/project-thread-ybe6jg
created: 2026-11-03
updated: 2026-11-03
---

## Intent

Close [issue #993](https://github.com/SOFTURE/AI/issues/993). `@softure-ai/files` serves stored files only through
public signed links. An adopting app that plays a stored video or shows an image to the signed-in owner inside its
own panel either mints a public link for its own viewing (a write, and the file becomes reachable without a session)
or copies the answer of `serveFileLink` (200/206/416, ranges, `private, no-store`, `nosniff`, sandboxing CSP). After
this change:

1. `serveStoredFile(ctx, fileId, request, { ownerId, disposition? })` in `/server`: the answer of `serveFileLink`
   (GET and HEAD, single byte ranges, the same headers, one 404 for anything missing or another owner's), without a
   link to verify;
2. `createStoredFileRoute({ getOwnerId, ... })` in `/next`: a `[id]` route that answers 404 without a session;
3. the README says the route sits behind the app's sign-in guard, unlike `/f`.

## Context

Labels: `enhancement`, `pkg: files`. Files: `modules/files/src/server/serve.ts`, `modules/files/src/server/index.ts`,
a new `modules/files/src/next/stored-file-route.ts`, `modules/files/src/next/index.ts`, tests in
`modules/files/tests/`, `modules/files/README.md` (§4), `modules/files/CHANGELOG.md`. PR #991 (#988, a browser upload
client in `files`) may touch `CHANGELOG.md` and `README.md` too; conflicts are resolved at merge time.

## Constraints

- `serveFileLink` answers exactly as in 0.2.0 (the shared code is a refactor).
- files does not depend on auth (the jobs pattern: the app passes `getOwnerId`).
- No version bump (the coordinator releases in a batch); the CHANGELOG gets an `Unreleased` entry.
- Files outside the package's storage stay out of scope (the issue's).

## Notes

- Framing: skipped. The issue names the gap and a concrete API; the code confirms it (`serveFileLink` is the only
  HTTP answer, the range and header logic lives inside it).
