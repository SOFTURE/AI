# Plan review: mcp-tokens-end-on-password-change

- Checked: the refresh check runs after the rotation `UPDATE` in the same transaction; on refusal the grant is
  deleted, so a stolen refresh token cannot retry. OK.
- Checked: the prune subqueries are full selects, so their columns are qualified and do not bind to the outer
  `DELETE`'s table. OK.
- Checked: API tokens go through `findValidToken` too, so both kinds are covered. OK.
- Verdict: approve.
