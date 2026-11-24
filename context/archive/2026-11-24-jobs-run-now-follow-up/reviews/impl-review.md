# Implementation review: jobs-run-now-follow-up

Verdict: approve. Matches the plan: `runScheduleNow` reads the live runs under both keys, joins a pending one, else
enqueues under the key no running run holds and re-reads on a lost race (the concurrent test settles three calls on
one follow-up); two running runs are joined, never a third. The tick skips the enqueue while any run is live, so a
pending follow-up absorbs the period (new test). No schema change; the partial unique index still bounds each key.
README, CHANGELOG with the migration note, version 0.1.15 (patch, the dependents' `^0.1.x` ranges hold).
