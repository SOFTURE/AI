---
change_id: auth-github-sign-in-840
verdict: approved
---

# Implementation review

- Plan conformance: both phases done as planned (996b4ff, 4ed8cc8). The allowlist moved to `allowlist.ts` so the
  GitHub step reuses it without a cycle; `getAllowedEmail` keeps its public export.
- Correctness: the shared checks (rate limit, cookie state, one-time row, error/`access_denied`, code length) run
  before the protocol switch, unchanged for OpenID Connect (the existing 489 auth tests pass untouched apart from the
  parsed `type` and the allowlist message). GitHub's 200-status OAuth errors fail the sign-in; a form-encoded answer
  (missing `Accept`) is a parse failure; `/user` and `/user/emails` failures are logged with core's code only.
- Security: the bearer token and the client secret go only to the fixed GitHub hosts (core follows no redirect); the
  token is a local value, a test checks it reaches neither the database nor the result. Only verified emails count.
  The nonce column gets a random value that is never sent.
- Tests: 16 new (options, start, full flow, linking, renamed login, allowlist over emails, denial, 200 errors,
  outages, replay). Gates: typecheck, ESLint, `vitest modules/auth` and `tests/repo` green.
- Docs: README "GitHub sign-in" subsection, CHANGELOG `Unreleased` with the type change named.
