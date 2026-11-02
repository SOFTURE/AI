---
change_id: jobs-owned-status-958
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (35b8fae).

- Scope: all five proposals of the issue are covered (owner on enqueue, `getOwnJob`, route with optional cancel,
  client hook, retention). Nothing beyond them except the `result_ref` home the second proposal needs.
- Privacy: the payload and error text never leave the server; the owner check is in the query, so another owner's
  job answers exactly like a missing one (no existence oracle).
- Races: the owner cancel puts the owner in every statement of the cancel instead of checking first.
- Compatibility: additive migration with a rollback; `Job` gains two fields; `ok()` handlers unchanged; the new
  retention key has a default.
- Dependencies: no auth, no pwa; the hook only needs React.
- Risk: the 0009 number depends on #955 keeping 0008 (agreed with the coordinator); conflicts in `admin.ts`,
  `options.ts` and the CHANGELOG with parallel jobs PRs are resolved when master is merged in.

Verdict: approved.
