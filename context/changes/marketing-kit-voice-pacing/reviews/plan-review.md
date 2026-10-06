# Plan review: marketing-kit-voice-pacing

Verdict: **approved** with three findings applied to the plan.

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| P1 | A dry run of several films printed only per-film estimates; the owner needs the batch's total before paying (FIRE budgeted characters against its balance). | should | Step 2.6: a dry run prints the batch's characters and estimate. |
| P2 | `waitForPace` is the piece a project's own script would reuse (FIRE has its own loop); the plan did not export it. | should | Step 2.7 exports `waitForPace` and `findLastRecordingTime`. |
| P3 | A failed call writes no `*.json`, so a shell loop that retries right after an error is not paced. | note | Accepted: the batch command stops at the first error, which is the supported way; the README says to use it instead of a loop. |
| P4 | After a fresh clone every cached file looks new, so the first paid call waits the full interval once. | note | Accepted: a logged delay, never a burst (research). |
| P5 | `all` must never wait: it reads the cache only. | check | Holds: `all` calls `produceVoiceover` without `--commit`; pacing applies only before `synthesize` (step 2.3). |

Coverage of change.md intent: pacing across runs (phase 2), stop at the first error (phase 2), real charge
(phase 1), disclosure (phase 3). Constraints: 0.1.6 config and cache unchanged (new keys optional with defaults,
key untouched), no paid call in tests (fake provider, injected `fetch`), version 0.1.7.
