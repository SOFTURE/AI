# Plan review: marketing-kit-film-followups

Verdict: **approved** with two notes applied to the plan.

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| P1 | A default change from rewind to fade changes every existing film's look on the next render. | note | Accepted: the owner's delivered FIRE film already uses a fade; `rewind` is one key away. Recorded in the README. |
| P2 | `cut` makes the transition 0 s; a `<video>` with `data-duration="0"` may break hyperframes. | should | Plan step 1.3: the clip is omitted for 0 s. |
| P3 | The flat-cache fallback must not be reached when the video's folder holds the pair, or a re-recorded film would read an old file. | must | Plan step 2.1 orders the lookup (folder first) and 2.4 tests it. |
| P4 | `today` must be a real calendar day, not just the pattern, or the clock starts at `Invalid Date`. | should | Step 3.1 and 3.4. |

Coverage of change.md intent: transition (phase 1), readable cache with old files found (phase 2), day in the
config (phase 3). Constraints: backward compatible config and cache, no paid call in tests, version bump.
