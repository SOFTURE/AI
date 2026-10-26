# Research: Chromium install survives a slow apt mirror (issue #820)

## Current state

- `themes.yml` → job `visual` (timeout 20 min): step "Install Chromium", `timeout-minutes: 5`,
  `npx playwright install --with-deps chromium`. Two parts in one command: the browser download from Playwright's CDN
  (~170 MB, chromium plus headless shell) and `apt-get install` of system libraries and fonts (~26 MB) from
  `azure.archive.ubuntu.com`.
- `e2e.yml` → jobs `e2e` and `stripe-sandbox`: the same command in `examples/next-app`, without a step timeout.
- Playwright resolves to 1.63.0 at the root and in the example app (`@playwright/test` `^1.63.0`); the browser
  revision follows the `playwright-core` version.
- Playwright keeps browsers in `~/.cache/ms-playwright` on Linux. `npx playwright install chromium` is a no-op when
  that revision is already there. `npx playwright install-deps chromium` runs only the apt part.
- `tests/repo/ci-workflows.test.ts` already guards a similar case (#672: ffmpeg from apt held the render job).
- `actions/cache@v6` is already used in `deploy-release-checks.yml`. A local action lives in
  `.github/actions/deploy/action.yml`.
- Composite action steps cannot carry `timeout-minutes`; the calling step can.

## Options for the apt part

1. Cache `.deb` files: `/var/cache/apt/archives` is root-owned, so restoring it needs a sudo copy step and a second
   cache; the fonts change rarely, but the gain is a few MB against extra moving parts.
2. A longer timeout on a step of its own (15 min) and a job timeout raised to match: a slow mirror delays the job.

Recommended: option 2, plus the browser cache. The browser is the large download; apt is ~26 MB, which even at
100 kB/s finishes in about 4.5 minutes, well within 15.
