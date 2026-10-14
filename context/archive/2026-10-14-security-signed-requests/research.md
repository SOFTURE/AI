# Research: security-signed-requests

Input: change.md, issue #469. Depth: quick.
Snapshot: f5830d0 on claude/project-thread-cxv9g2, 2026-10-14 19:10 CEST.

## Summary

`@softure-ai/security` has a size-capped UTF-8 body reader and nothing for request signatures. The closest code is
billing's Stripe verifier (`node:crypto`, sync, `t=,v1=` header, several `v1` accepted, tolerance 300 s). The new
signer and verifier must run on Web Crypto (`crypto.subtle`, global in Node 22 and in Workers), so they are async.
`readSmallBody`'s streaming loop can be shared: the byte reader does the streaming, the text reader decodes its
result. A Worker should be able to import the signer without the module factory, whose top level calls
`resolveMigrationsDir(import.meta.url, ...)`; a dedicated sub-path export keeps that import side-effect free.

## Current state

- `modules/security/src/read-small-body.ts:21-62`: checks `content-length`, refuses a used or locked body, streams
  with a running byte count, cancels the reader over the cap, then decodes with `TextDecoder("utf-8", { fatal: true })`.
- `modules/security/src/contract.ts:5-9`: `SecurityErrorCode` union; `src/messages/en.ts` has one message per code.
- `modules/security/src/index.ts`: root entry, `defineModule` at top level plus re-exports.
- `modules/billing/src/stripe-webhook.ts:23-73`: `signStripePayload` / `verifyStripeSignature`, lenient header parse
  (unknown keys ignored, `v1` must be 64 hex), `|now - t| > tolerance` refused, `timingSafeEqual` per candidate.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Signature helpers | `modules/security/src/signed-request.ts` (new) | sign and verify on Web Crypto |
| Body reader | `modules/security/src/read-small-body.ts` | `readSmallBodyBytes`, shared streaming |
| Contract and copy | `src/contract.ts`, `src/messages/en.ts` | `security.signature_invalid` |
| Entry points | `src/index.ts`, `package.json` `exports` | root re-export, `./signed-request` sub-path |
| Docs | `README.md`, `CHANGELOG.md` | usage and migration |
| Tests | `tests/signed-request.test.ts` (new), `tests/read-small-body.test.ts` | behaviour |

## Data

None.

## Tests

`npx vitest run modules/security` runs the package tests; `tests/read-small-body.test.ts` builds streamed requests
with `ReadableStream` (helper `streamOf`). `tests/repo/packages.test.ts` checks every `exports` entry (source, types,
built file) and that the CHANGELOG's newest section is `Unreleased` or the current version.

## Patterns to follow

- Results via `ok`/`err` from `@softure-ai/core` (`read-small-body.ts:4`).
- Programming errors throw `RangeError` naming the function and input (`read-small-body.ts:24`).
- Header parsing and tolerance as in `stripe-webhook.ts:55-69`.

## Prior work

- `context/archive/2026-10-02-security-rate-limit/`: the package and `readSmallBody`.
- Billing's Stripe webhook verifier (same header shape).

## SOFTURE modules

Partially covered: security has the body cap, billing has a Stripe-only, Node-only verifier. The generic, Web Crypto
helper belongs in security, as the issue proposes.

## Risks

- Timing leak in the comparison: compare fixed-length digests with an XOR loop over every byte; low.
- A short or empty secret silently accepted: verifier fails closed with the error code, signer throws; low.
- Worker bundle pulling Node code: sub-path entry imports only `@softure-ai/core`'s result helpers (`sideEffects:
  false`); low.

## Relevant lessons

- L-001 (tsc, not bundlers): the sub-path is a plain tsc output like `./server`.

## Answers to unknowns

- Minimum secret length: 32 characters (256 bits of a random hex or base64 secret covers HMAC-SHA256's block
  strength); exported as a constant so both sides see it.
- Future timestamps: refused outside the same window (clock skew both ways), as billing does.

## Open questions

None.

## Decisions (auto)

- Helpers are async (Web Crypto), not sync `node:crypto`: one implementation for Node and Workers.
- `secret` accepts one string or a list, on both sides: the sender signs with every listed secret during a rotation
  (one `v1` each), the receiver accepts any listed secret.
- Sub-path `@softure-ai/security/signed-request` in addition to the root re-export.
