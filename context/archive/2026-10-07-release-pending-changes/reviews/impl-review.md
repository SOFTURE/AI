# Implementation review: release-pending-changes

Date: 2026-10-07 · Verdict: approved

- Seven `chore(release)` commits from `release:version`: deploy 0.1.4, security 0.1.7, ops 0.1.7, marketing-kit
  0.1.9. The charts, ui and seo bumps were dropped again: open changes (#194, #197) bump them too, and each package is released once. Each promoted its `## Unreleased` section; `module.json` and inline
  manifests follow the package version (repo tests).
- `deploy-cli-version` defaults in `deploy-app.yml` and `deploy-report.yml` move to 0.1.4, as
  `tests/repo/deploy-workflows.test.ts` requires; callers get the new CLI once 0.1.4 is on npm (published from the
  same merge).
- Local tags deleted; `auto-release` creates them on `master`.
- Gates: typecheck, lint and `npm test` green.
