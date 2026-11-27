# Implementation review: mcp-access-client-name

Verdict: approve. The diff matches the plan: `McpServerIdentity` gains optional `via` (`McpClientVia`, exported) and
`clientName`; `findValidToken` selects the token's name in the query it already runs, `verifyAccessToken` derives
`via` from `grantId`, `authenticate` carries both in `AuthInfo.extra`, and `readIdentity` adds them only when both are
well-formed, still throwing only for a missing user id. The stdio entry sets `via: "stdio"`, `clientName: "stdio"`.
Checked cases: a hand-issued token gives `token` and its label; an OAuth access token gives `oauth` and the same name
as the connected apps list (grant tokens are stored under the client's cleaned registered name, so the 60-character
cut from registration carries over); stdio; the exact `verifyAccessToken` value. No extra query per request. API
tokens share `findValidToken` and ignore the new column. agent-ready and the example app still type-check, since the
fields are optional. README (endpoint section and the `onToolCall` example) and CHANGELOG `Unreleased` follow.
