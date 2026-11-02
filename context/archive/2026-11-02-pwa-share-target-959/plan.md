# Plan: pwa-share-target-959

Input: change.md, research.md

## Goal
`share_target` in the manifest, a share route that hands the app a parsed share with streamed files, the sign-in
round trip, docs (iOS included) and a Playwright helper.

## Approach
One `ShareTargetOptions` object (`action`, `params` field names, `files`) the app passes to both
`createManifestRoute({ shareTarget })` and `createShareTargetRoute({ shareTarget, handle })`, so the manifest and the
route never disagree. The route answers `GET` (query) and `POST` (`multipart/form-data`, streamed). It finds the
first http(s) URL in `url`, then in `text`. Files are an async iterable of parts read in order; a part whose type the
field does not accept is skipped. `handle` returns a same-origin path; the route answers 303 to it. With `getUser`,
a signed-out share goes 303 to `signInPath?next=<action>?<url,text,title>`; the route's `GET` resumes it.
Rejected: a pwa dependency on files/auth (research); `formData()` (buffers).

## Phase 1: share target, route, docs
**Discipline:** TDD. **Files:** `modules/pwa/src/share/*`, `src/manifest.ts`, `src/next/share-target-route.ts`,
`src/next/index.ts`, `src/index.ts`, README, CHANGELOG, `tests/share-*.test.ts`.
1. `share/share-target.ts`: `ShareTargetOptions`, `resolveShareTarget` (checks: action a same-origin path, unique
   non-empty field names, `accept` entries MIME patterns or extensions; files force POST multipart),
   `buildManifestShareTarget`.
2. `share/shared-url.ts`: `findSharedUrl({ url, text })`: the first http(s) URL, trailing punctuation and an
   unbalanced `)` dropped, checked with `new URL`.
3. `share/multipart.ts`: `readMultipart(body, boundary, limits)` streaming parser; `share/accept.ts`:
   `isAcceptedFile(accept, { contentType, name })`.
4. `manifest.ts`: `shareTarget` option → `share_target`.
5. `next/share-target-route.ts`: `createShareTargetRoute` → `{ GET, POST }`: 400 for a malformed body or wrong
   content type, 413 for a text field over `maxFieldBytes` (16 KiB), files beyond `maxFiles` (10) skipped, the rest
   of the body cancelled after `handle`, a path that is not same-origin is a bug (throws).
6. README (§3, §4, §12 iOS and limitations), CHANGELOG `Unreleased`, module manifest mount entry.
Done when the tests cover GET, POST with files streamed (first chunk seen before the body ends), split boundaries at
every byte, skipped types, field limit, malformed bodies, the sign-in round trip, URL extraction cases.

## Phase 2: Playwright helper
**Discipline:** test-after (real Chromium). **Files:** `foundation/testing/src/playwright/share.ts`, its export,
testing README/CHANGELOG, `foundation/testing/tests/playwright-pwa.test.ts`.
`shareToApp(page, { action, method?, fields?, files? })`: a GET navigates to the action with the query; a POST sends
the multipart through the page's request context (its cookies) without following the redirect, then navigates the
page to the `Location`, like the system's share navigation. Returns the response status and the final URL.
Done when a Chromium test shares text and a file to a small server and lands on the redirected page.

## Risks and rollback
- A platform that puts text fields after the files: the fields are read up to the first file part; later text fields
  are ignored. Chrome writes title, text and url before the files. Documented.
- Rollback: revert the PR; nothing persists.

## Decisions (auto)
- D1 pwa stays without `files`/`auth` dependencies; the README shows `saveFile` with the streamed part.
- D2 Signed-out POST share: the link and text survive the sign-in redirect, files do not (no storage without an
  owner). Documented.
- D3 The optional offline replay of a POST share in the service worker is left out (issue marks it optional); the
  README lists it under limitations.
- D4 Route signature `handle({ user, request }, share)`: the context first, as the issue sketches.
- D5 A file part of a field the target does not declare is skipped, like a type it does not accept.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: share target, route, docs

#### Automated
- [x] 1.1 Manifest `share_target`, option checks, URL extraction, multipart parser, route behaviour tested — 4144fcf
- [x] 1.2 README and CHANGELOG updated — 4144fcf
- [x] 1.3 Gates green (typecheck, lint, test) — 4144fcf

### Phase 2: Playwright helper

#### Automated
- [x] 2.1 `shareToApp` exported and tested in Chromium — 8e98e99
- [x] 2.2 Gates green (typecheck, lint, test) — 8e98e99
