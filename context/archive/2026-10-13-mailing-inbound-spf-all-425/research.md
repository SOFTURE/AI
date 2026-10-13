---
change_id: mailing-inbound-spf-all-425
---

# Research: mailing-inbound-spf-all-425

Sources: `modules/mailing/src/server/dns.ts`, `modules/mailing/tests/dns.test.ts`, `modules/mailing/src/cli/run.ts`,
`modules/mailing/README.md` (section "Sender DNS check"), RFC 7208 §4.6.2, §5.1, §6.1.

- `checkInboundSpf(txt, host, include)` (dns.ts) fails on lookup error, `multiple`, `missing`, and `missing-include`
  when no term equals `include:_spf.mx.cloudflare.net` (a `+` qualifier and a trailing dot tolerated). It never looks
  at `all`, so `v=spf1 include:_spf.mx.cloudflare.net ?all` passes.
- The sender check `checkSpf` already treats `+all` and a bare `all` as `permissive` (warn) with
  `/(^|\s)\+?all(\s|$)/i`; it is a different check and stays as is.
- RFC 7208: mechanisms are evaluated left to right and those after `all` are never tested (§5.1); a record with no
  match returns `neutral` (§4.7), like `?all`; `redirect=` (§6.1) applies only when no `all` is present.
- `weak` is already a `DnsFinding` (DMARC uses it). The CLI prints every inbound check's finding and counts failures
  generically (run.ts), so a new failure reason needs no CLI change.
- Tests: `describe("checkSenderDns inbound: cloudflare")` with an `it.each` of SPF failures; the fixtures
  `CLOUDFLARE_SPF` and the second pass case both end in `~all`.
