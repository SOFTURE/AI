---
change_id: security-alerts-hono-codeql-80
title: "security: patch hono and @hono/node-server, fix CodeQL js/bad-code-sanitization in marketing-kit (issues #1245-#1253)"
status: archived
archived_at: 2026-11-16
roadmap_item: null
issue: 1245
branch: claude/project-thread-ub4gug
created: 2026-11-16
updated: 2026-11-16
---

## Intent

The Security tab has no open alert with an upstream fix: the seven Dependabot alerts on `hono` and
`@hono/node-server` and the CodeQL alert #80 in `@softure-ai/marketing-kit` are fixed, and the issues the alert sync
opened for them (#1245, #1246, #1247, #1249, #1250, #1251, #1252, #1253) close themselves.

## Context

- Dependabot alerts #34-#40: `hono` 4.13.12 (fixed in 4.13.16) and `@hono/node-server` 2.1.3 (fixed in 2.1.6), both
  transitive through `hyperframes` 0.9.20, a runtime dependency of `@softure-ai/marketing-kit`. `hyperframes` declares
  `hono ^4.0.0` and `@hono/node-server ^2.0.5`, so the fix is a lockfile update inside the declared ranges.
- CodeQL alert #80 (`js/bad-code-sanitization`, `tools/marketing-kit/src/footage/overlay-html.ts` line 197): the
  dropped-letter tween writes `JSON.stringify(turns)` into the composition's script.
- Issue labels: `security`, `pkg: marketing-kit` (#1245).

## Scope

- `package-lock.json`: `hono` 4.13.18, `@hono/node-server` 2.1.8.
- `overlay-html.ts`: write the turns as a number array literal (each value a finite number) instead of
  `JSON.stringify`; output unchanged.
- One combined patch release: `marketing-kit` (the fix) and the packages whose published manifest changed on master
  since their last tag (Dependabot raised the `zod` floor to `^4.6.7`, plus `node-html-parser` in seo and
  `lucide-react` in theme-flat-atlas, and a type-only cleanup in auth).

## Constraints

- No behaviour change: existing exact-output tests of the tweens stay green.
- No change to `hyperframes` itself (an adopting app resolves `hono` within the same ranges).

## Notes

- Research: kept short in `research.md`; framing skipped, the alerts name the outcome.

## Done

- Lockfile: `hono` 4.13.18, `@hono/node-server` 2.1.8 (Dependabot alerts #34-#40).
- marketing-kit: drop-letter turns written as a number literal (CodeQL #80).
- Patch versions for the combined release: marketing-kit 0.36.2, agent-ready 0.2.1, alerts 0.2.1, analytics 0.3.3,
  auth 0.2.13, connections 0.4.1, feature-switches 0.2.1, mailing 0.2.6, ops 0.2.5, privacy 0.2.2, seo 0.2.2,
  waitlist 0.5.2, host 0.1.2, theme-flat-atlas 0.3.4; published by `auto-release.yml` after the merge.
