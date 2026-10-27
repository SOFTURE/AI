---
change_id: auth-optional-oidc-messages-786
title: "auth: OpenID Connect message keys optional in AuthMessages (issue #786)"
status: archived
roadmap_item: null
issue: 786
branch: claude/project-thread-cvdn8i
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #786](https://github.com/SOFTURE/AI/issues/786): an app that types its own dictionary as
`AuthMessages` keeps compiling when it bumps auth past 0.2.6 without configuring `oidc`. The OpenID Connect keys
(`oidc`, `errors.auth.oidc_*`) become optional in `AuthMessages`; wherever they are read, a missing key falls back to
the English copy. The release becomes really additive, as the 0.2.6 changelog claims.

## Context

- Labels: bug, pkg: auth. Found while adopting auth 0.2.6 in an adopting app with a typed custom dictionary.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- English only in the package; no new locale.

## Notes

- Framing: skipped. The issue names the outcome and the preferred option.
