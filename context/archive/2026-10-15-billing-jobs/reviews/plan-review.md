# Plan review: billing-jobs

Verdict: **approved** (autonomous, `--auto`).

- Coverage of the issue's asks: 1 (handlers, optional peer) Phase 1; 2 (outage → backoff retry, permanent → failJob)
  Decisions + tests; 3 (recurring scheduling) via jobs schedules from #491; 4 (README recipe, CHANGELOG migration)
  Phase 2. Complete.
- Fits the #491 pattern, so apps see one shape across packages.
- Lazy import is needed: billing's mailing peer is optional and the entry must load without it. Checked: the
  `./mailing` entry statically imports `@softure-ai/mailing/server`.
- `quota_exceeded` as `failJob`: a retry within the backoff window (minutes to an hour) rarely meets a reset quota;
  the next daily period resumes from the ledger, so nothing is lost. Accepted.
- Long runs: the handler ignores `signal`; mails already handed over are recorded by the ledger, so an aborted run
  costs nothing but time. Accepted; `limit` caps a run when an app needs that.
- Risk: merge conflicts with PR #485. Mitigation in the plan.
