---
change_id: mailing-inbound-spf-all-425
status: open
---

# Plan: inbound SPF requires -all or ~all (issue #425)

Input: change.md, research.md. Complexity: small (one function, tests, docs).

## Phase 1: weak inbound SPF (TDD)

Files: `modules/mailing/src/server/dns.ts`, `modules/mailing/tests/dns.test.ts`.

1. Tests first, in the inbound SPF `it.each`: `?all`, `+all`, bare `all`, no `all`, and `redirect=` without `all`
   fail as `weak` with the record; a pass case with `-all`; a record whose first `all` is `-all` followed by `?all`
   passes; a record without the include and with `?all` stays `missing-include`.
2. Implement: after the include check, find the first term that is `all` with an optional qualifier; pass only for
   `-` or `~`, else `{ status: "fail", finding: "weak", host, record }`.

## Phase 2: docs

`modules/mailing/README.md` INBOUND bullet names `weak`; the `inbound` doc comment in dns.ts;
`modules/mailing/CHANGELOG.md` gets `## Unreleased`.

## Progress

- [x] Phase 1: weak inbound SPF (`5913798`; 10 tests, written first and red before the fix)
- [ ] Phase 2: docs
