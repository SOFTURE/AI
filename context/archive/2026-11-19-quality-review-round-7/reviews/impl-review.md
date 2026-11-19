# Implementation review: quality-review-round-7

- runDueJobs: a recording failure still propagates (awaits `outcome`); the timer stops before the next claim
  (awaits `done`). Default heartbeat is a third of the lease, so short test handlers never see a tick.
- handleWebhook: the age check runs after validation and before anything is recorded.
- Verdict: approve.
