---
change_id: deps-security-audit-2026-11
title: "deps: patch the vulnerable dependencies npm audit reports on master (next RCE, zod, markdown-it, vite, undici, happy-dom, fflate, minimatch)"
status: archived
roadmap_item: null
issue: 1101
branch: claude/project-thread-bj5w5w
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

`npm audit` on master reports no vulnerabilities that have an upstream fix. Adopting apps learn from the release
notes which of their own dependencies (`next`) they must update.

## Context

Issue #1101. `npm audit` on master `f05735c` reports 20 vulnerabilities (1 critical, 7 high, 12 moderate): `next`
16.3.8 (unauthenticated RCE), `zod` 4.6.5, `markdown-it` 15.0.2 (runtime dependency of `@softure-ai/blog`), `vite`
8.3.2, `undici` 7.30.0, `happy-dom` 20.14.5, `chromium-bidi`/`puppeteer-core` (nested zod), `fflate` 0.7.3 (pinned
by satori), `minimatch` 10.2.6 (via eslint and typescript-eslint).

Files: `package.json`, `package-lock.json`, `examples/next-app/package.json`, `examples/next-app/package-lock.json`,
`modules/blog/package.json`, `modules/blog/CHANGELOG.md`, `modules/blog/src/render/markdown-it-footnote.d.ts`, `modules/analytics/src/options.ts`,
`modules/analytics/CHANGELOG.md`.

## Scope

- Lockfile bumps within the declared ranges: zod, vite, undici, puppeteer-core, chromium-bidi.
- `next` to the latest 16.4.x in the root devDependencies and in `examples/next-app` (pinned there).
- `markdown-it` floor `^15.0.3` in `@softure-ai/blog`, with a changelog entry; it rides the next combined release.
  markdown-it 15.0.3 ships its own types, so `@types/markdown-it` and `@types/markdown-it-footnote` go and a local
  declaration types the footnote plugin.
- `happy-dom` to 21.x (dev only).
- `@softure-ai/analytics`: keep the `channelField` limit message under zod 4.6.6+ (union branches abort on `.max`).
- Root `overrides` for `fflate` (satori pins 0.7.3 in every version) and `minimatch` (eslint ranges stop at 10.x).

## Constraints

- The modules' `next` peer range stays `^16.0.0`: raising it would force a release of every module for a
  dependency the adopting app owns. The release notes say to update `next`.
- Runtime `zod` floors stay `^4.6.5`: the range already admits the fixed version, a fresh install picks it.
- No behaviour change; all gates stay green.

## Notes

- Framing: skipped. The issue names the outcome (an audit with no fixable findings).

## Done

- `npm audit` reports 0 vulnerabilities on the branch (root and `examples/next-app`), commit 9f53ebe.
- `@softure-ai/blog` and `@softure-ai/analytics` carry `## Unreleased` entries and ride the next combined release.
- Residual outside this repository: an app installing `@softure-ai/marketing-kit` still gets satori's exact
  `fflate` 0.7.3 (moderate) until satori lifts its pin.
