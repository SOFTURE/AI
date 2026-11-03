---
change_id: files-owner-serve-993
status: done
---

# Plan: serve a stored file to its owner (issue #993)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: server function, tests (TDD)

Files: `modules/files/src/server/serve.ts`, `modules/files/src/server/index.ts`, `modules/files/tests/owner-serve.test.ts`.

- Extract `answerStoredFile(ctx, request, row, { name, disposition })` from `serveFileLink`; `serveFileLink` calls it
  with the link's name and `links.disposition`.
- `serveStoredFile(ctx, fileId, request, { ownerId, disposition = "inline" })`: 405 for other methods, `findLiveRow`
  with the owner, 404 when missing, else `answerStoredFile` with `row.originalName`.
- Export `serveStoredFile` and `ServeStoredFileOptions` from `/server`.
- Tests: whole file (200, headers incl. CSP, nosniff, no-store, inline disposition with the stored name); a range
  (206, `Content-Range`); suffix range; unsatisfiable (416); HEAD without a body; another owner's, unknown id, a
  non-uuid id, a deleted and an expired file all the same 404; POST 405; `disposition: "attachment"`.

## Phase 2: Next route

Files: `modules/files/src/next/stored-file-route.ts`, `modules/files/src/next/index.ts`, `modules/files/tests/next.test.ts`.

- `createStoredFileRoute({ getOwnerId, disposition?, getContext? })` → `{ GET, HEAD }` with
  `(request, { params: Promise<{ id }> })`; no owner → 404 (the same body as a missing file).
- Tests: owner gets 206 for a range and 200 on HEAD; no session 404; another user 404.

## Phase 3: docs

Files: `modules/files/README.md` (§4.4 new), `modules/files/CHANGELOG.md` (`## Unreleased`), the package
description.

- README: the route mount, behind the sign-in guard (listed in `protect`, no edge bypass), when to use it instead of a
  link; the server function for an app with its own route.
- CHANGELOG: the entry and the migration (drop the own link minting or copied answer).

## Decisions (auto)

- Shared internal answer rather than a copy over `openFile` (one place for ranges and headers).
- `inline` default for the owner route (viewing in the app is its purpose); the link default stays `attachment`.
- A Next factory with `getOwnerId` like jobs, instead of a dependency on auth.
- No session answers 404, not 401: the issue asks it, and the route never tells whether a file exists.

## Progress

- [x] Phase 1: server function, tests (ef1dd07)
- [x] Phase 2: Next route (b5f4fa1)
- [x] Phase 3: docs (3d8054a)

## Verification

- `vitest run modules/files`: 16 files, 204 tests passed; `owner-serve.test.ts` failed (8 of 8) before `serveStoredFile`
  existed (red first).
- `npm run typecheck`, ESLint and the language gate green in the pre-commit hook on every commit.
