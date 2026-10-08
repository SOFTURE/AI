# Implementation review: mcp-access-oauth-body-cap

Reviewed: the branch diff against plan.md, change.md and issue #255.
Verdict: **approve** (one wording fix applied before the commit).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Suggestion | `readCappedBody`'s comment named only registration and token, while the consent decision uses it too. | Fixed: the comment says why the cap comes before any parsing. |
| 2a | Warning | The full suite failed 3 tests in `module.test.ts` and `adoption.test.ts`: the manifest version in `src/index.ts` stayed 0.1.8 while `package.json` and `module.json` moved to 0.1.9. | Fixed: manifest version 0.1.9. |
| 2 | Check | Drift from plan: none. Decisions 1–5 are implemented as written: option bounds 1024–1048576, default 16384; registration limits then reads; the token endpoint counts an oversized body per address and answers 429 over the limit, else 413; the decision checks `Origin` first, then reads, then parses the capped text with the request's `content-type`. | No change. |
| 3 | Check | Unchanged answers: unreadable registration body → `400 invalid_client_metadata`, unreadable token body → empty form → `401 invalid_client`, unreadable consent form → empty `400`. Every pre-existing test in `tests/oauth-http.test.ts` passes unchanged. | No change. |
| 4 | Check | Security: `readSmallBody` checks `Content-Length` and counts the stream, so a missing or understated header does not let a larger body through (streamed test on registration and token). An oversized token flood still spends the sender's `mcp-oauth` budget (test: `limit` × 413, then 429). The `Origin` check still runs before any body is read on the decision route. | No change. |
| 5 | Check | Tests were red on master: 4 new body-cap tests and 3 option tests failed before the implementation (413 expected, 400/401/303 received; missing `maxBodyBytes`); green after. | No change. |
| 6 | Check | Docs: README option row and rate-limit note, CHANGELOG `0.1.9`, version 0.1.9 in `package.json`, `module.json`, `src/index.ts` and `package-lock.json`. | No change. |

Gates: see plan.md Progress.
