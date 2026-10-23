# Research: a scripted fake fetch (issue #664)

## Current state (master d530152)

- `@softure-ai/core` `requestJson` takes `fetch?: FetchFunction`, `(input: string | URL, init: RequestInit) =>
  Promise<Response>`, and passes an `AbortSignal` in `init.signal` for its timeout (`http-json.ts`).
- Ad-hoc fakes: `modules/billing/tests/stripe.test.ts` (a recording `vi.fn`), `modules/seo/tests/indexnow.test.ts`
  (`respondWith(status)` plus `mock.calls` inspection), `tools/marketing-kit/src/voice/elevenlabs.test.ts`,
  `modules/blog/tests/jobs.test.ts`, `modules/agent-ready/tests/webmcp*.test.ts`, `foundation/core/tests/http-json*`,
  `modules/connections/src/testing/fake-provider.ts` (its own router). Each re-implements matching, answering and
  recording; none fails loudly on an unexpected request.
- `@softure-ai/testing` main entry exports the Vitest helpers; `vitest` is an optional peer and the entry imports it
  only as a type. It has no runtime dependency on core.

## Findings

- Testing has no dependency on core, so core and every module can take testing as a dev dependency without a
  cycle. The helper belongs in `@softure-ai/testing`.
- A `Response` body is single-use: a repeated answer needs a fresh `Response` per call. Statuses 101, 103, 204, 205
  and 304 cannot carry a body; scripting a body with them must fail when the fake is built, not mid-test.
- Calling code may catch a rejected `fetch` (requestJson maps it to a network error), so a rejection alone does not
  fail a test. The unmatched call has to be recorded and reported by the final check as well.
- `new Response(init.body).text()` reads every `BodyInit` kind (string, `URLSearchParams`, `Uint8Array`, `Blob`,
  `FormData`, stream); a `Request` input is read through `clone().text()`.
- URLs compare best after `new URL(...).href` normalisation (a bare origin gains its `/`); `Request.url` is already
  normalised. A `RegExp` with the `g` or `y` flag keeps `lastIndex`, which must be reset before each test.
