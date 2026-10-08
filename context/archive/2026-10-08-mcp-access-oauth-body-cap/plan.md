---
change_id: mcp-access-oauth-body-cap
status: archived
---

# Plan: cap the OAuth request bodies (issue #255)

## Today

- `handleClientRegistration` (`modules/mcp-access/src/server/oauth-http.ts`): rate limit by address, then
  `await request.json()`; a parse failure answers `400 invalid_client_metadata`.
- `handleTokenRequest`: `new URLSearchParams(await request.text().catch(() => ""))` *before* the rate limit, because
  the limit key carries the client id from the body; an unreadable body becomes an empty form, which ends in
  `401 invalid_client` after the limit is counted.
- `handleAuthorizationDecision`: same-origin check, then `await request.formData().catch(() => null)`; null answers
  an empty `400` with `cache-control: no-store`.
- `readSmallBody(request, { maxBytes })` (`@softure-ai/security`, already a dependency) returns
  `Ok<string> | Err<"security.body_too_large" | "security.body_unreadable">`; it checks `Content-Length` and counts
  the stream, and refuses invalid UTF-8 as unreadable. `billing` maps too large → 413, else 400.

## Decisions

1. **Option `oauth.maxBodyBytes`**, `z.int().min(1024).max(1_048_576).default(16_384)`. The floor keeps a typo from
   breaking every real client; the ceiling keeps the option a cap, not a way around it.
2. **Registration:** rate limit first (unchanged order), then `readSmallBody`. Too large → `413 invalid_request`
   ("The request body is larger than N bytes."); unreadable → `400 invalid_client_metadata` as today; text →
   `JSON.parse`, failure → `400 invalid_client_metadata`.
3. **Token endpoint:** read first (the limit key needs the client id). Too large → count the request by address only
   (`limitProtocolRequest(ctx, request)`), answer 429 when that is over, else `413 invalid_request`. Unreadable →
   `""` as today. A flood of oversized bodies therefore still spends the sender's address budget.
4. **Consent decision:** same-origin check first (unchanged), then `readSmallBody`. Too large → empty `413` with
   `no-store`; unreadable → empty `400` as today. The text is parsed with
   `new Response(text, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData()`, so
   urlencoded and multipart forms keep working; a parse failure → `400`.
5. A small private helper `readCappedBody(ctx, request)` reads the cap from the options, so the three call sites
   share one line and one `maxBytes`.

## Phase 1: cap the three bodies (TDD)

Files: `modules/mcp-access/src/options.ts`, `modules/mcp-access/src/server/oauth-http.ts`,
`modules/mcp-access/tests/oauth-http.test.ts`, `modules/mcp-access/tests/module.test.ts`.

1. Tests first, red on master:
   - registration: a 17 KiB JSON body → `413 invalid_request`; a body whose `Content-Length` is absent but whose
     stream exceeds the cap → `413`; invalid UTF-8 → `400 invalid_client_metadata`;
   - token: an oversized form → `413 invalid_request`, counted in the address's limit (after `limit` oversized
     requests the next one answers `429`); invalid UTF-8 → `401 invalid_client` as an empty form today;
   - consent: an oversized form → `413`; a multipart form still decides (`303`); invalid UTF-8 → `400`;
   - a configured `oauth.maxBodyBytes: 2048` refuses a 3 KB registration that the default accepts;
   - module options: default `maxBodyBytes: 16384` in the parsed options (both whole-object `toEqual` assertions in
     `tests/module.test.ts` updated), bounds refused with their messages.
2. Implement decisions 1–5.

Done when: the new tests fail on master and pass after the change; `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build` are green.

## Phase 2: docs

Files: `modules/mcp-access/README.md` (option row, a sentence under the public routes), `modules/mcp-access/CHANGELOG.md`
(`## 0.1.9`), version 0.1.9 in `modules/mcp-access/package.json` and `module.json` (auto-release tags the version
found on master, as 0.1.8 was shipped).

Done when: the README table lists `oauth.maxBodyBytes` with its range and default, and the CHANGELOG describes the
413 answers.

## Progress

- [x] Phase 1: cap the three bodies (new tests red on master, green after)
- [x] Phase 2: docs, version 0.1.9

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green. The first full `npm test` failed 3
tests (manifest version still 0.1.8 in `src/index.ts`, see impl-review #2a); after the fix the module's 208 tests pass
and the full suite runs again in pre-push.
