---
change_id: core-request-form-676
---

# Research

## requestJson today (`foundation/core/src/http-json.ts`)

- `RequestJsonWriteOptions` is an interface: `method`, `body?: unknown`, `idempotencyKey?`. It is used only in
  intersections (`requestJson`'s overloads, `connections`' `RequestWithConnection` and `ConnectionRequestOptions`);
  nothing in the repository `extends` it, so turning it into a union of two shapes keeps every use compiling.
- The body is `JSON.stringify(options.body)` outside the try (a value JSON cannot represent throws). `FormData`,
  `URLSearchParams` and `Blob` have no enumerable own properties, so they become `"{}"`; a `ReadableStream` too.
- `content-type: application/json` is set when there is a body and the caller set none.
- The timeout is `AbortSignal.timeout`, passed as `signal`; it covers the upload because `fetch` sends the body under
  the same signal.

## fetch and form bodies (Node 22, undici)

- `fetch` with a `URLSearchParams` body sets `content-type: application/x-www-form-urlencoded;charset=UTF-8` unless
  the caller set one; with a `FormData` body it sets `multipart/form-data; boundary=...`. A hand-set multipart type
  has no boundary, so the server cannot parse the body.
- `new Response(body)` applies the same rules, so a test or a fake can turn `init.body` into text and parse it back
  with `Response.formData()`, which yields `File` parts with `name`, `type` and `size`.
- Both bodies can be sent again, so a retried call (`requestWithConnection` after a refreshed token) sends the same
  form.

## connections (`modules/connections/src/server/request.ts`)

`sendWithConnection` spreads the caller's options and only replaces `headers`, then calls `requestJson`. A `form`
option therefore passes through with no code change; the overloads take it once `RequestJsonWriteOptions` does.
Issue #675 edits this file in parallel, so this change leaves it alone and adds tests and docs only.

## testing (`foundation/testing/src/fetch/fake-fetch.ts`)

`readCall` records `body` as text (`new Response(init.body).text()`) and `json`. A form body is recorded as its
encoded text today (multipart with a random boundary), which a test cannot compare usefully.

## Hand-rolled copies

`modules/connections/src/server/token-client.ts` (`postForm`) and `modules/billing/src/stripe.ts` repeat the rules
for form bodies. Moving them is optional in the issue and left to a follow-up.
