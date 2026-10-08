# Plan: analytics-channel-tagger-scope

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

`createChannelTagger(config, { targets })` limits `tag` to named targets; `tag` redirects on the request's own
origin when `Host` is that origin and not a configured one; `isNavigation` is exported from `/proxy` and the
README lists the headers it needs. Tests, README, CHANGELOG (0.1.9 entry).

**Out of scope:** scoping `carry` (it rewrites a redirect another piece already answered with, so it adds no
request); scoping `<ChannelKeeper />` in the browser; the auth guard's own redirect host.

## Findings (the reading behind the plan)

- `src/proxy/index.ts` `tag`: the channel is known only after `readRequestChannel`; when it is not null the
  request has a parseable `Referer` (the request's own parameter was excluded one line earlier), so the page
  the visitor came from is available for a predicate.
- `readPublicOrigin` falls back to `new URL(request.url).host` when `Host` is missing, so a test `Request`
  without `Host` already resolves to the request URL's origin when that origin is configured.
- `deriveChannel` is the precedent for an app hook that throws: log `@softure-ai/analytics: <label> failed:
  <message>` and fall back to "do nothing".
- `tests/support.ts` `createRequest` builds a `Request` with `sec-fetch-mode: navigate` by default and no `Host`.

## Key decisions

- **D1** `targets?: readonly string[] | ((context: { target: URL; source: URL }) => boolean)` on
  `ChannelTaggerOptions`, read once at creation (like `channelFromReferer`); not a per-call argument, so the
  proxy line stays `channels.tag(request)`. A list holds absolute pathnames (start with a single `/`, no `?` or
  `#`), normalised through `URL` (percent-encoding, as in `pixel.pages`) and compared exactly with the target's
  `pathname`; an empty list or a bad entry throws at creation. A predicate gets copies of the target (the
  request URL) and the source (the `Referer` page); only `=== true` tags; a throw is logged
  (label `channelTagger.targets`) and tags nothing.
- **D2** The scope check runs after the cheap checks (navigation, own parameter) and after the channel is known,
  so the predicate sees only requests that would otherwise be tagged.
- **D3** Redirect origin: `readPublicOrigin(config, request)` first (unchanged); else, when the request carries
  a `Host` header equal to the request URL's host, that host with the scheme from the first
  `X-Forwarded-Proto` value when it is `http` or `https`, else the request URL's scheme (plan review F1); else
  `appOrigin`. Requiring the
  header keeps the "internal host behind a proxy" case (no `Host` match) on `appOrigin`, and the target host is
  always one the request was sent to, so no open redirect. No option: the behaviour is what the issue asks and
  is safe by construction.
- **D4** `isNavigation(request)` exported from `/proxy` unchanged; README § Mounting lists the three header
  shapes it accepts and states that a proxy stripping `Sec-Fetch-*` (and Next's headers) makes `tag` inert.
- **D5** CHANGELOG: add to the unreleased `0.1.9` entry; versions stay 0.1.9.

## Phase 1: scope, host, export (TDD)

- Tests (`tests/proxy.test.ts`, new describe blocks):
  - `targets: ["/kalkulator", "/register"]`: a tagged-page navigation to `/register` redirects; to `/cennik`,
    `/login`, `/register/x` passes (null); a `/caf%C3%A9`-style encoded path matches its listed `/café`;
  - a predicate gets `target` and `source`: tags `/register` only from `/blog/...` sources; a throwing predicate
    gives null and one log line; a truthy non-boolean does not tag;
  - bad lists are refused at creation (empty, relative, `?`, `#`, `//host`);
  - without `targets` every path is still tagged (existing tests);
  - host: request `http://localhost:3100/register` with `Host: localhost:3100` redirects to
    `http://localhost:3100/register?z=…`; with `Host: public.example` (unconfigured) and an internal URL it goes
    to `appOrigin`; without `Host` the internal-host test stays on `appOrigin`; with `Host` equal to the URL's
    host and `X-Forwarded-Proto: https` the target is `https://`;
  - `isNavigation`: true for `Sec-Fetch-Mode: navigate`, `RSC: 1`, `Next-Url` (no dest or `empty`); false for a
    bare GET, POST, an image with `Next-Url`.
- Code: `src/proxy/index.ts`; README §4 and the option description (incl. F2, F3); CHANGELOG 0.1.9.

Done when: the new tests were seen red, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: scope, host, export

#### Automated
- [x] 1.1 Tagger tests seen red, then green — 5d31d96
- [x] 1.2 Gates green (typecheck, lint, test, build) — 5d31d96
- [x] 1.3 README and CHANGELOG (0.1.9 entry) — 5d31d96
