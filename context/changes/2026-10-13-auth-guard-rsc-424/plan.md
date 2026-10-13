---
change_id: auth-guard-rsc-424
status: open
---

# Plan: auth guard drops _rsc from next= (issue #424)

Input: change.md, research.md. Complexity: small (one helper, tests, docs).

## Phase 1: drop _rsc from next= (TDD)

Files: `modules/auth/src/proxy/index.ts`, `modules/auth/tests/guard.test.ts`, `modules/auth/README.md`,
`modules/auth/CHANGELOG.md`.

1. Tests first: the issue's reproduction (`/history?view=years&_rsc=abc` under `protect: ["/"]` →
   `next=%2Fhistory%3Fview%3Dyears`); `_rsc` alone leaves no `?`; `_rsc` first, middle and repeated; an encoded name
   (`%5Frsc`) is dropped; other parameters keep their spelling (`q=a%20b&flag`); a parameter merely containing
   `_rsc` (`x_rsc=1`, `_rsc2=1`) is kept; the `relative` redirect drops it too.
2. Implement `getReturnPath(url)`: split `url.search` on `&`, drop segments whose decoded name is `_rsc`, rejoin;
   undecodable names are kept.
3. Docs: README route guard paragraph mentions it; CHANGELOG `## Unreleased`.

## Progress

- [ ] Phase 1: drop _rsc from next=
