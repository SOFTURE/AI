---
change_id: files-owner-serve-993
verdict: approved
---

# Implementation review: files-owner-serve-993

- Scope: the three proposals of #993, nothing else. `serveFileLink` now calls the shared `answerStoredFile`; its
  answer is unchanged (the 35 link tests pass untouched).
- `serveStoredFile`: the owner filter is in the SQL lookup (`findLiveRow`), so another owner's, an unknown, a
  malformed, a deleted, an expired and a byte-less file are the same `404` (tested, headers and body pinned). The
  sandbox CSP and `nosniff` are on every answer.
- `createStoredFileRoute`: no session answers the same `404` through the exported `notFound`, so there is one copy of
  it. A throwing `getOwnerId` or context propagates (Next answers 500), as a storage failure does in `serveFileLinkRoute`.
- No dependency on auth: the app passes `getOwnerId`, the jobs pattern.
- Docs: README §4.4 puts the route behind the sign-in guard and contrasts it with `/f` and `/u`; CHANGELOG
  `Unreleased` entry with the migration. `module.json` gets no mount: the route is optional and its path is the app's.
- Merge with #991 (browser client): CHANGELOG entries kept side by side; that change took §4.3, so this one is §4.4.
- Approved without changes.
