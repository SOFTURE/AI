---
change_id: mcp-access-oauth-body-cap
reviewed: 2026-10-08
verdict: approved with fixes applied
---

# Plan review: mcp-access-oauth-body-cap

Checked plan.md against change.md, issue #255, `server/oauth-http.ts`, `security/src/read-small-body.ts`, the billing
caller and the existing tests.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `tests/module.test.ts` compares the whole parsed `oauth` object with `toEqual` (defaults and a configured set). Adding `maxBodyBytes` turns both red unless updated; the plan listed the file but not these two assertions. | Accepted: Phase 1 step 1 updates both expectations to carry `maxBodyBytes`. |
| 2 | Warning | Token endpoint: answering an oversized body with 413 before the rate limit would let a sender flood the endpoint with bodies that never count. | Already in decision 3 (count by address first); kept, and a test asserts the 429 after `limit` oversized requests. |
| 3 | Suggestion | "Invalid UTF-8 → 401 on the token endpoint" is a change of path, not of answer: today `text()` replaces bad bytes and the junk form also ends in `invalid_client`. | Accepted as written; the test pins the answer, not the path. |
| 4 | Suggestion | Parsing the consent form from text drops binary multipart parts. The consent form has only text fields (`AUTHORIZATION_PARAMS`, `decision`, `canWrite`), and `readSmallBody` refuses non-UTF-8 anyway. | No change; noted in the CHANGELOG line. |
| 5 | Suggestion | The version bump must reach `module.json` too (the 0.1.8 commit changed both). | Already in Phase 2. |

No Critical findings. Research and framing skips are justified in change.md.
