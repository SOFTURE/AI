# Implementation review: deploy-verify-web-bot-auth

Reviewed: the branch diff against plan.md and issue #341.

- D1: `src/verify/web-bot-auth.ts` signs on `node:crypto` with agent-ready's profile; its tests verify the headers
  with the reference library `web-bot-auth` (keyid, tag, nonce, agent, five-minute validity) and show a signature
  for another authority does not verify. No dependency on agent-ready.
- D2: an unset, empty or malformed variable is a reason naming the variable; the runner test checks that no request
  was sent and that the value is nowhere in the report.
- D3: `agent` defaults to the verified URL's origin (runner test with the reference library on the received request).
- D4: a `forEach` source and its entries are signed one by one; the schema refuses `signature*` in `requestHeaders`
  next to `webBotAuth`.
- D5: `runVerify` takes `env`; the CLI uses `process.env`. D6: CHANGELOG 0.1.8, README, JSON schema regenerated.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Minor | The key is parsed once per request rather than once per run. | Accepted: an Ed25519 key import costs microseconds, and per-request reading keeps the runner's flow unchanged. |
| F2 | Suggestion | `deploy-app.yml` cannot hand the key to its verify job. | Accepted as the D5 follow-up issue. |
