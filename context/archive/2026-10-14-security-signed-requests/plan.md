# Plan: security-signed-requests

Input: change.md, research.md. Complexity: small (two phases).

## Goal

`@softure-ai/security` exports `signRequestBody`, `verifySignedRequest` and `readSmallBodyBytes` as issue #469
proposes, the signer and verifier on Web Crypto and importable from `@softure-ai/security/signed-request` without the
module factory; README and CHANGELOG describe how an app (and its sending worker) switches to them.

**Out of scope:** billing's Stripe verifier, a version bump or release, any adopting app.

## Key decisions

- Signed payload: the bytes of `"<t>."` followed by the body bytes (a string body is UTF-8 encoded).
- Header `t=<seconds>,v1=<hex>[,v1=<hex>...]`; unknown keys ignored, a `v1` that is not 64 lowercase hex ignored,
  a missing or repeated `t` or no usable `v1` is invalid.
- Verifier: `Err<"security.signature_invalid">` for a missing or short secret, a null or malformed header, a timestamp
  more than `toleranceSeconds` (default 300) away from `now` in either direction, or no matching MAC. An invalid
  `toleranceSeconds` throws `RangeError`. Signer: throws `RangeError` on a short secret or an invalid `now`.
- `readSmallBodyBytes` owns the streaming; `readSmallBody` decodes its bytes.

## Phase 1: Body bytes

- `readSmallBodyBytes(request, { maxBytes })` in `read-small-body.ts`; `readSmallBody` built on it; tests for bytes in
  a non-UTF-8 charset, the cap and the empty body.

Done when: `npx vitest run modules/security` green.

## Phase 2: Signed requests

- `src/signed-request.ts` with `signRequestBody`, `verifySignedRequest`, `MIN_SIGNING_SECRET_LENGTH`,
  `SIGNED_REQUEST_TOLERANCE_SECONDS`; error code and message; root re-export and `./signed-request` export;
  tests (round trip, string and bytes, rotation, stale and future timestamp, malformed headers, short secret, tampered
  body); README section and CHANGELOG `Unreleased`.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Body bytes

#### Automated
- [x] 1.1 `readSmallBodyBytes` returns capped raw bytes; `readSmallBody` decodes them — 4484bf8
- [x] 1.2 Package tests green — 4484bf8

### Phase 2: Signed requests

#### Automated
- [x] 2.1 Signer and verifier on Web Crypto with the error code, exports and sub-path — 6ce1691
- [x] 2.2 README and CHANGELOG describe the helpers and the migration — 6ce1691
- [x] 2.3 Typecheck, lint, test and build green — 6ce1691
