# Plan review: connections-user-oauth

Verdict: proceed.

- Warning: reusing `connections.accounts` with a user column was considered and refused: every query, the admin page,
  privacy and rotation would need an owner filter, and a miss would show users' grants to the admin. Separate entry.
- Warning: the token client's provider type is narrowed to `tokenUrl` and `clientAuth`, so both callers share it
  without a fake `OAuthProviderDefinition`. Accepted.
- Suggestion: the bearer revocation sends the access token in a header only, never a form. Accepted.
