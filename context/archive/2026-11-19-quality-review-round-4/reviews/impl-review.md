# Implementation review: quality-review-round-4

- The tick checks the lease end before anything else; the rejection branch uses the same check. The hanging test
  replays the held `update` calls when the switch turns off, so no query stays pending after the test.
- `lookup` prints the fallback line only when a fetch failed; the main branch fetch is skipped when the notes fetch
  already failed (the same remote), and its reason is reported then.
- The unexpected error line masks `//user:secret@` as the git reasons do.
- Verdict: approve.
