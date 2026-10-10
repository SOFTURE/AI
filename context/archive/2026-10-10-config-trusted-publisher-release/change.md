---
change_id: config-trusted-publisher-release
title: "config: release 0.1.1 through the npm trusted publisher"
status: archived
roadmap_item: null
issue: null
branch: claude/config-0.1.1-trusted-publisher-erwhu8
created: 2026-10-10
updated: 2026-10-10
archived_at: 2026-10-10
---

## Intent

`@softure-ai/config` 0.1.0 was its first publish, so it went out with `NPM_TOKEN`. The owner has since bound the
package's trusted publisher on npmjs.com (GitHub Actions, `SOFTURE/AI`, `release.yml`, no environment). Version 0.1.1
proves that binding: its release must publish through OIDC with no token. A reviewer checks the version bump, the
CHANGELOG entry and the runbook note on how to verify a new trusted publisher.

## Context

The release workflow already uses the trusted publisher for every package that exists on npm and prints a notice
saying so. 0.1.0 carries a provenance attestation although it was published with the token, so provenance alone
cannot tell the two paths apart; the run's notice can.

## Process notes

- Research: skipped. `release.yml`, `auto-release.yml` and `scripts/release/README.md` answered every unknown.
- Framing: skipped. The goal (validate the publisher) is given by the owner.

## Decisions (auto)

- No code change: nothing in the package needs fixing, and a docs-only release is the honest content.
- Record the verification step in the runbook, since every new package goes through the same check.
