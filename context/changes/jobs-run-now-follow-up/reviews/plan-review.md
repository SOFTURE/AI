# Plan review: jobs-run-now-follow-up

Verdict: approve. Two alternating keys keep the unique index as the bound on live runs without a migration; the tick
still collapses periods into any live run; the race between two callers settles on the index (the loser re-reads and
joins the pending run). Tests cover running, pending, alternation and the unchanged idle case. Patch keeps the ten
dependents' `^0.1.x` ranges.
