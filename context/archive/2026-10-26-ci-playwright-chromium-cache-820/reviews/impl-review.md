---
change_id: ci-playwright-chromium-cache-820
verdict: approved
---

# Implementation review

Reviewed commit 6249d7f against plan.md.

- Plan followed: one composite action (`.github/actions/playwright-chromium`), used by `themes.yml` → `visual` and
  `e2e.yml` → `e2e` and `stripe-sandbox`, each step with `timeout-minutes: 15`; the `visual` job timeout is 30.
- Baselines: the cache key is the resolved `playwright-core` version, read from the folder that runs the tests, so the
  example app's own install decides its key.
- The browser download runs only on a cache miss; `install-deps` runs every time. `actions/cache` saves in its post
  step only when the job succeeds, so a failed download is never cached.
- The `stripe-sandbox` step keeps its `if:` guard; its 15-minute step timeout stays below the 25-minute job timeout.
- Test: `tests/repo/ci-workflows.test.ts` pins the action's use, the cache path and key, the miss-only download and
  the timeouts; it failed before the change (missing action file) and passes now.
- Gates: typecheck and ESLint green in the pre-commit hook; the full `npm run lint` ran out of memory in the container
  and runs in CI.

Verdict: approved, no changes.
