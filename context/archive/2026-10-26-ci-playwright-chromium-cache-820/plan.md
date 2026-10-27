---
change_id: ci-playwright-chromium-cache-820
status: archived
---

# Plan: Chromium install survives a slow apt mirror (issue #820)

Input: change.md, research.md. Complexity: small (CI only).

## Phase 1: shared install action, wired into themes.yml and e2e.yml, guarded by a repository test

Files: `.github/actions/playwright-chromium/action.yml`, `.github/workflows/themes.yml`,
`.github/workflows/e2e.yml`, `tests/repo/ci-workflows.test.ts`.

1. Test first: every "Install Chromium" step in `themes.yml` and `e2e.yml` uses the local action, with a step timeout
   of at least 15 minutes and below its job's timeout (when the job has one); the action caches
   `~/.cache/ms-playwright` with a key that holds the resolved `playwright-core` version, installs the browser without
   `--with-deps`, and runs `install-deps` separately. Fails on master.
2. The composite action: input `working-directory` (default `.`); resolve the `playwright-core` version from there;
   `actions/cache@v6` on `~/.cache/ms-playwright` keyed `playwright-chromium-<os>-<version>`; on a miss
   `npx playwright install chromium`; always `npx playwright install-deps chromium`.
3. `themes.yml`: the step uses the action with `timeout-minutes: 15`; job timeout 20 → 30. Keep the comment on why
   Playwright's own build.
4. `e2e.yml`: both steps use the action with `working-directory: examples/next-app` and `timeout-minutes: 15`.

## Decisions (auto)

- Longer timeout on a separate apt part instead of cached `.deb` files (research, option 2).
- One composite action, so the three jobs cannot drift apart.
- The browser install runs only on a cache miss; on a hit only `install-deps` runs, as the issue proposes.

## Progress

- [x] Phase 1: shared install action, wired into themes.yml and e2e.yml, with a repository test (6249d7f)
