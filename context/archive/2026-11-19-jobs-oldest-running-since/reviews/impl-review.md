# Implementation review: jobs-oldest-running-since

Verdict: approve. No drift from the plan.

- Checked: the migration is additive and nullable (rollback in its header); the claim of a lease-expired job resets
  `claimed_at` to the new attempt's start; finished jobs never count (status filter).
