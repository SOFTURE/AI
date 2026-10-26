---
change_id: ci-playwright-chromium-cache-820
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `themes.yml`, `e2e.yml` and `tests/repo/ci-workflows.test.ts`.

- Scope: matches the issue's three asks; CI only, no package touched.
- Baselines: the cache key carries the `playwright-core` version, so a Playwright bump misses the cache and installs
  the new pinned build; the cache never serves a stale revision.
- Timeouts: composite steps cannot set `timeout-minutes`, so the calling step carries it (15), below the job timeout.
- Risk: a cache restored for a version whose browser download was interrupted would hold a partial directory; the
  cache is saved only when the job succeeds (post step), so a broken install is never saved.
- Tests: the workflow test pins the action's use, the key and the timeouts, in the style of the #672 guard.

Verdict: approved, no changes.
