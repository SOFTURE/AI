# Plan: security-alerts-hono-codeql-80

## Phases

1. Lockfile: `npm update hono @hono/node-server`; evidence `npm ls` and `npm audit`.
2. marketing-kit: `toScriptNumberArray` replaces `JSON.stringify(turns)`; a unit test pins the literal; CHANGELOG.
3. Release bumps (patch) with CHANGELOG entries for marketing-kit and the 13 packages with unreleased manifest changes;
   `deploy-cli-version` untouched (deploy is not released).

## Acceptance

- `npm audit` 0 vulnerabilities; overlay tests green; typecheck, lint, tests green in CI.
- After merge, `auto-release.yml` publishes every bumped version (evidence: run link, `npm view`).

## Decisions (auto)

- Release the zod-floor packages now: the raised floor carries the zod fix to fresh installs, and the owner asked for
  one combined release.

## Progress

- [x] p1 lockfile: bd461645, hono 4.13.18, @hono/node-server 2.1.8, npm audit 0
- [x] p2 marketing-kit sanitization fix: 9d8ae978, overlay tests 27/27
- [x] p3 release bumps: 89b6bd01 changelogs, b8ab2bf1..8f3787c7 14 chore(release) commits
