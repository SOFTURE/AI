---
change_id: auth-github-secret-names-846
status: archived
---

# Plan: GitHub sign-in secret names (issue #846)

Input: change.md. Complexity: trivial (docs and one validation message).

## Phase 1: rename in the example and the hint

Files: `modules/auth/README.md`, `modules/auth/src/options.ts`, `modules/auth/CHANGELOG.md`.

1. README section 3, "GitHub sign-in": `clientIdEnv: "GH_AUTH_CLIENT_ID"`, `clientSecretEnv: "GH_AUTH_CLIENT_SECRET"`,
   plus one sentence: GitHub Actions refuses secret names that start with `GITHUB_`, so keep that prefix off.
2. `githubProviderSchema`: the regex messages name `GH_AUTH_CLIENT_ID` and `GH_AUTH_CLIENT_SECRET`.
3. CHANGELOG `## Unreleased`: one bullet.

## Decisions (auto)

- `GH_AUTH_*`, the names the issue proposes.
- No runtime check rejecting `GITHUB_*` names: the variable is read from the server environment, where the prefix is
  allowed; only GitHub Actions secrets refuse it, so a warning in docs is the right level.
- Test fixtures keep `GITHUB_AUTH_*` (the issue allows it; they never reach GitHub Actions).

## Progress

- [x] Phase 1: rename in the example and the hint (54bc3cc)
- [x] Implementation review: approved
