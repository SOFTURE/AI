# Plan: files-browser-upload-client-988

Input: change.md, research.md

## Goal

`@softure-ai/files/client` exports `sendUpload` and `createUploadQueue`; the upload page runs the same `sendUpload`.

## Approach

- `src/client/send-upload.ts`: `sendUpload(file, { uploadUrl, signal?, onProgress?, fetch? })`. `HEAD` first; the
  session's own chunk size and received ranges decide which chunks are missing; each is sent in order with
  `Content-Range`; progress `{ sentBytes, totalBytes }` once at the start and after every chunk. Answers
  `Ok<{ sentBytes, totalBytes }>` or `Err` with `files.upload_expired` (`404`), `files.upload_rejected` (another
  `4xx`, or a file whose size is not the session's), `files.network` (a thrown fetch, `429`, `5xx`) and
  `files.upload_aborted` (the signal). Self-contained (no reference outside its body) so the page can inline it.
- `src/client/upload-queue.ts`: `createUploadQueue({ open, finalize, concurrency?, describeError?, fetch?,
  createId? })` keeping `UploadQueueItem[]` (`id`, `name`, `size`, `state`, `progress` 0–100, `error`, `errorCode`),
  assignable to theme-notion's `UploadFileItem`. `add`, `retry`, `pause`, `resume`, `remove`, `getItems` (a stable
  snapshot), `subscribe`. `open` and `finalize` are the app's server actions; a session is kept across pause and
  retry and opened again only after `files.upload_expired`. A run that was paused or removed is ignored when it
  settles (a run counter per item).
- The upload page replaces its loop with the inlined `sendUpload`.
- Rejected: a React hook (adds a React peer), a script asset route (a second answer on a signed route).

## Phase 1: the sender and the page

**Discipline:** TDD. **Files:** `src/client/send-upload.ts`, `src/client/index.ts`, `src/contract.ts`,
`src/messages/en.ts`, `src/server/upload-page.ts`, `package.json` (`./client`), `tests/client.test.ts`,
`tests/upload-route.test.ts`.

Tests against the real route (`serveUpload` as the `fetch`): a full send; a resume that sends only the missing chunk;
progress values; `404` after expiry; a size mismatch; an abort between chunks; a thrown fetch; the page's inlined
source run on its own.

Done when the tests pass and the page carries the sender's source.

## Phase 2: the queue and the docs

**Discipline:** TDD. **Files:** `src/client/upload-queue.ts`, `src/client/index.ts`, `tests/client-queue.test.ts`,
`README.md`, `CHANGELOG.md`, `package.json` (description).

Tests: add → done with finalize called once with the session; concurrency; pause and resume keep the session and
send only what is missing; remove aborts and drops the item; a failed open, send and finalize show the message and
retry recovers; an expired session is opened again on retry; listeners are notified and unsubscribe works.

Done when the tests and every gate pass.

## Risks and rollback

- A transform that injects code into `sendUpload` (coverage instrumentation) would break the inlined page script;
  the inlined-source test catches it. Rollback: revert the commits; nothing on the server changes.

## Decisions (auto)

- The chunk size comes from the session's `HEAD`, not from an option: the server refuses any other alignment.
- `files.upload_aborted` is a fourth code next to the three the issue names, so an abort is a value, not a throw.
- A controller instead of a React hook (research.md).
- No server-side cancel on `remove`: the package has none; the session expires and `files.prune` removes it.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: the sender and the page

#### Automated
- [x] 1.1 `sendUpload` tests pass against the real route — a9349ec
- [x] 1.2 The page runs the inlined sender — a9349ec
- [x] 1.3 Gates green (typecheck, lint, test) — a9349ec

### Phase 2: the queue and the docs

#### Automated
- [x] 2.1 Queue tests pass — bd90407
- [x] 2.2 README and CHANGELOG describe the client — bd90407
- [x] 2.3 Gates green (typecheck, lint, test, build) — bd90407
