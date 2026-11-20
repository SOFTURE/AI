# Implementation review: pwa-keeps-no-pages

Verdict: approve.

- Matches the plan: a positive `maxPages` behaves as before (the existing navigation tests are unchanged and pass).
- With `maxPages: 0` the pages cache is never opened, so nothing is kept and nothing old is served.
- The tests fail without the change (8) and pass with it.
