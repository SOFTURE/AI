---
change_id: auth-oidc-opt-in-786
title: "auth: OpenID Connect strictly opt-in, inert parts documented (issue #786, follow-up)"
status: archived
roadmap_item: null
issue: 786
branch: claude/project-thread-30yjgp
created: 2026-10-27
updated: 2026-10-27
archived_at: 2026-10-27
---

## Intent

Answer the follow-up comment on [issue #786](https://github.com/SOFTURE/AI/issues/786) (2026-10-27): OpenID Connect
sign-in is opt-in per app, and an app that does not enable it bumps auth with nothing to change and nothing it does not
use. The message keys are already optional (PR #796, auth 0.2.7). What remains: the OpenID Connect tables
(`auth.identities`, `auth.oidc_states`) and rate limit buckets (`oidc-start`, `oidc-callback`). Either an app without a
provider does not get them, or the upgrade notes say they are inert and list exactly the steps every app takes.

## Context

- Labels: bug, pkg: auth, adoption. Reopened for the follow-up comment.
- Apps bump packages nightly and trust the changelog to tell an additive release from one that needs work.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- 0.2.7 is taken; six packages depend on auth `^0.2.0`, so the next release is a patch.
- Migrations move forward only; a migration already applied in apps is never changed or removed.

## Notes

- `frame` skipped: the problem is stated precisely by the issue comment.
