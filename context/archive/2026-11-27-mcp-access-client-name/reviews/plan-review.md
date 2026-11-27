# Plan review: mcp-access-client-name

Verdict: approve. The name is read in the query that already verifies the bearer, so the issue's "no extra query per
tool call" holds. Taking it from the token row is right: grant tokens are named after the client at issue time with
the cleaned, 60-character name, so it equals `OAuthGrantView.clientName`. Optional fields are the safe shape here:
identities are built outside the endpoint (the package's own check helpers, app tests, agent-ready discovery), and
required fields would break agent-ready's promise that an app's factory fits as is. `readIdentity` must keep throwing
only for a missing user id; a missing client name is not a security concern. The tests cover both kinds of bearer,
the 60-character cut and stdio, red first. The patch release follows the dependent-range rule.
