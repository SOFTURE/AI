# Research: files-owner-serve-993

## What exists

- `serveFileLink(ctx, request)` (`src/server/serve.ts`): method check (405 with `Allow`), `verifyFileLink`, then
  `findLiveRow`, link generation check, headers (`private, no-store`, `nosniff`, `no-referrer`, content type,
  `accept-ranges`, `content-disposition` from `links.disposition` and the name in the URL, `sandbox` CSP),
  `parseRangeHeader` (200, 206, 416), HEAD without a body, storage stream; a row without bytes is a logged 404.
- `findLiveRow(ctx, id, { ownerId })` already makes another owner's file read as missing and rejects non-uuid ids.
- `openFile` covers bytes and ranges but not the HTTP answer.
- `/next` mounts `serveFileLinkRoute` and `serveUploadRoute`; both are sessionless by design.
- Precedent for a session-aware route in a module that must not depend on auth: `createJobStatusRoute({ getOwnerId })`
  in `@softure-ai/jobs/next` (#958): the app passes `getOwnerId: async () => (await getCurrentUser())?.id ?? null`,
  `params` of the `[id]` segment give the id, the route returns `{ GET, DELETE }` handlers.

## Options

1. Extract the part of `serveFileLink` after the row is known into one internal function
   (`answerStoredFile(ctx, request, row, { name, disposition })`) and build both `serveFileLink` and
   `serveStoredFile` on it. One copy of the range and header logic; the link answer unchanged.
2. Implement `serveStoredFile` over `openFile`: a second copy of headers, the issue's complaint inside the package.

Chosen: option 1.

## Next helper

`createStoredFileRoute({ getOwnerId, disposition?, getContext? })` returning `{ GET, HEAD }` for
`app/<prefix>/[id]/route.ts`. No owner → the same 404 (the issue asks 404, and 404 does not reveal that a file
exists). A failing `getOwnerId` or context is logged and propagates as an error (Next answers 500), as
`serveFileLinkRoute` does with a storage failure.

## Disposition default

The owner route exists to show a file inside the app (player, cover), so `inline` by default; `attachment` on request.
The name is the stored `originalName`.
