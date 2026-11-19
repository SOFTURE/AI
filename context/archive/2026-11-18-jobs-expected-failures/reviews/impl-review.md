# Implementation review: jobs-expected-failures

Verdict: approve (auto). No drift from the plan; the flag is read only on `retry: false`; the line keeps its message
so searches for "job run failed" still find it; no payload in the line.
