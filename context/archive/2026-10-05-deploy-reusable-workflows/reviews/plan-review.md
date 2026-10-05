# Plan review: deploy-reusable-workflows

Date: 2026-10-05 · Verdict: approved

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Intent coverage | PASS | build to GHCR, SSH deploy with DP-1's env render, verify, both domain spots as inputs, example caller and test |
| Scope | PASS | owns `deploy-*.yml`, `tools/deploy/examples/`; leaves `tools/deploy/src/` to DP-3 and DP-4; server side to DP-5 |
| Unknowns answered | PASS | moving `deploy-workflows-v1` tag (SHA for immutability); the repository is public, so no Access setting |
| Security | PASS | inputs validated in a first job; no `${{ }}` in scripts; host key pinned; secrets only in `deploy`; minimal permissions |
| Testability | PASS | structural repository test plus actionlint with shellcheck in CI; no live deploy needed |
| Conventions | PASS | follows `blog-links.yml`; English only; no new package or CLI change |

Findings:

- **W1 (warning):** FIRE's `release.yml` could not be read, so step parity (e.g. a release report post, image
  pruning) is unverified. Accepted: recorded as a `deploy-followups` gap.
- **W2 (warning):** the workflow cannot run until `@softure-ai/deploy` is on npm (DP-8). Accepted: the default CLI
  version is tied to the package version by the test, and the README says so.
- **S1 (suggestion):** `app-secrets` as `toJSON(secrets)` also carries `github_token`; `env render` writes only the
  compose file's names, so it never reaches `.env.prod`. Taken: the README says to prefer naming the secrets when the
  app has many unrelated ones.
- **S2 (suggestion):** two shellcheck notes in `release.yml` are touched only by spelling, so the release behaviour
  stays the same. Taken into Phase 2.
