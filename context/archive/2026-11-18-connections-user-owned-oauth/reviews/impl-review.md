# Implementation review: connections-user-owned-oauth

Verdict: approve after one fix.

- Found while testing: the admin's `startConnectionAction` would start an authorization of a user provider (owned by
  the admin). Fixed: it answers `connections.wrong_owner`, as `startOwnConnectionAction` does for an app provider;
  covered in `tests/next-owned.test.ts`.
- `connectedAccounts` in the export stays the app connections the user made; a user's own ones are in
  `ownConnections`, so an existing export reader sees no change in meaning.
- Log lines add `owner_id=` only for owned connections, so the app's lines are byte for byte as before.
