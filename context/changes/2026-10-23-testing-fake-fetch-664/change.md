---
change_id: testing-fake-fetch-664
title: "testing: a scripted fake fetch (issue #664)"
status: in_progress
roadmap_item: null
issue: 664
branch: claude/project-thread-s3jpy0
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #664](https://github.com/SOFTURE/AI/issues/664): code built on `requestJson` (core) and on third-party
APIs takes an injected `fetch`, and every test suite writes its own fake for it. Add one shared, scripted
`fakeFetch` to `@softure-ai/testing`: routes by method and exact URL or `RegExp`, answers in order or repeatedly
with JSON, a raw body, a status, headers, a thrown error or a delay that respects `init.signal`, records every call
(method, URL, lower-case headers, body, parsed JSON), fails an unmatched call with its method and URL, and checks at
the end that every scripted answer was used.

## Context

Labels: `enhancement`, `pkg: testing`. Moving the existing ad-hoc fakes is not part of this change. No release in
this change: the coordinator releases testing in the next combined release.

## Constraints

- No real request ever leaves a fake: an unmatched call rejects and is reported by `expectAllUsed`.
- No runtime dependency on Vitest: the helper throws plain errors, so it works under any runner.
- The `fetch` it returns fits both core's `FetchFunction` and `typeof fetch`.

## Notes

- Framing: skipped. The issue names the problem and the API.
