---
change_id: connections-download-824
verdict: approved
---

# Implementation review

Reviewed the diff from c91ca66 against plan.md.

- Every ask of issue #824 is covered: `downloadWithConnection` in `/server` and `/next`, `method`, a JSON `body`,
  `accept`, `Ok<{ bytes: Uint8Array, contentType }>`, a size cap, a `fetch` option, the same refresh and 401 rules and
  codes.
- One credential path: `requestWithConnection` and `downloadWithConnection` both go through `callWithConnection`; the
  existing request tests pass unchanged.
- One set of HTTP rules: `requestBytes` reuses `requestJson`'s status mapping, `Retry-After` parsing, body builder and
  timeout; the helpers are exported from `http-json.ts` for the sibling module only, not from the package index.
- Size cap: `Content-Length` checked first, then enforced per chunk with the reader cancelled; tests use a stream
  pulled only on read, so they prove nothing past the cap is read.
- Safety: no caught error's text, URL or header reaches a result; misuse (`maxBytes`, a GET with a body) throws before
  anything is sent.
- Gates: typecheck, lint and the language gate green in the hooks; core 530 and connections 167 tests pass.
- Release note: connections needs the core release with `requestBytes`; the coordinator raises the range when it
  releases (both changelogs say so).

Verdict: approved, no changes.
