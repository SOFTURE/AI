---
change_id: guarded-page-fetch-636
---

# Research: a guarded page fetch and readable text (issue #636)

## Where it happens

- `modules/security/src/server/guarded-request.ts`: `sendGuardedRequest`. URL checks (parse, `http:`/`https:`,
  no credentials, `allowedPorts`, IP literal through `isPublicAddress`), then `http(s).request` with `agent: false`
  and `guardLookup`, which resolves every address and refuses the socket when any is not public
  (`BlockedAddressError` → `security.outbound_blocked`). One timer; the response is destroyed at the status.
- `modules/security/tests/guarded-request.test.ts`: a fake server on loopback with the seam
  (`isAllowedAddress`, `resolveHost`, `request`).
- Codes live in `src/contract.ts` (`SecurityErrorCode`) and copy in `src/messages/en.ts` (`errors.outbound_*`).
- `modules/seo/src/server/html-to-markdown.ts` already parses pages with `node-html-parser` (6.1.13 in the
  lockfile): `parse`, `querySelector(All)`, `.remove()`, `[hidden]`/`[aria-hidden]` dropping. It builds no DOM
  that runs scripts; entities are decoded by `he`.

## Facts that shape the fix

- Node's `http.request` never follows redirects, so each hop is a new request; the guard can be reused per hop
  by splitting `sendGuardedRequest` into a URL check and an "open" step that hands over the response.
- A 3xx `Location` may be relative; it resolves against the hop's URL. 301/302/303 turn into GET (the fetch is
  GET only anyway); 304 and a 3xx without `Location` are a final answer.
- Servers often send `content-encoding: gzip|br|deflate`. `zlib` streams decode them; the cap must count the
  decoded bytes (a small gzip can expand far past `maxBytes`).
- Charset: the `content-type` parameter; an HTML page often declares it only in `<meta charset>` or
  `<meta http-equiv="content-type">` within its first 1024 bytes (the HTML spec's prescan window).
- `TextDecoder` (Node full ICU) decodes `windows-1250`, `iso-8859-2` and the other WHATWG labels; an unknown
  label throws `RangeError`, so the caller decides; the helper takes a string.
- Plain `http:` is common for a saved link (a redirect to `https:` follows), so a page fetch defaults to ports
  `[80, 443]`, while `sendGuardedRequest` keeps `[443]`.
