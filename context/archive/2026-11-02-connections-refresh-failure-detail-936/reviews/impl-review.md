---
change_id: connections-refresh-failure-detail-936
verdict: approved
---

# Implementation review

Reviewed the diff of 247ddc3 against plan.md and the issue's acceptance.

- Acceptance: `tests/refresh-failure-936.test.ts` covers a 400 `{"error":"invalid_request"}`, a 503 without a body
  and a network failure: each checks the failure value, the exact warn line and the stored columns (and the view).
  The fake's 400 carries an error description quoting a fake token; the test checks it, the stored ciphertext and the
  client secret never reach the log.
- Every writer of `last_error` keeps the new columns consistent (refresh failure, `invalid_grant`, success, connect,
  key save); the database refuses a detail without a code (`accounts_error_detail_check`, tested).
- Types: `ConnectionsRefreshFailure` extends `Err`; `GetAccessTokenResult`, `GetCredentialResult`,
  `GetCredentialHeaderResult` and `ConnectionRequestFailure` use `ConnectionsTokenFailure`, so narrowing on the code
  exposes the fields and nothing else changes for callers.
- Deviation from the issue, recorded: the field is `httpStatus`, not `status`, because `requestWithConnection`
  answers token failures and `core.http_*` failures in one union, and a `status` there already means the provider
  API's answer (a 401 from the token endpoint must not read as an API 401).
- Existing tests that compared a bare `refresh_failed` were tightened to the exact detail, none loosened.

Verdict: approved, no changes.
