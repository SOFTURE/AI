# Plan review: jobs-oldest-running-since

Verdict: approve.

- Warning, accepted: `updated_at` is not a start time (lease extensions move it); a column of its own is needed.
- Suggestion, accepted: keep it off `Job`, so no returned shape changes.
