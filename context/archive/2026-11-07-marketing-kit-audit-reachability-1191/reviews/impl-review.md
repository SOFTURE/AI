---
change_id: marketing-kit-audit-reachability-1191
verdict: approved
---

# Implementation review (auto)

- #1191: `assertLocalReferences` (`compose/html.ts`) throws on the first remote `src=`, `href=`, CSS `url(...)` or
  `@import` address (`http(s)://` or protocol-relative); `composeFilm` and `composeFootage` return through it, so
  hyperframes' download helper, its only use of the pinned `undici`, is never called from the kit.
- Tests written first (5 failed without the change): a remote recording, a protocol-relative logo and a remote font
  face in `composeFilm`; a remote clip and an http logo in `composeFootage`. Every existing compose, render and
  repository test passes unchanged, so today's compositions carry no remote reference.
- README "npm audit": the two findings, their GHSA ids, the pins, the upstream pull requests and why neither is
  reachable; the app-side overrides kept. CHANGELOG `## Unreleased`.
- Evidence: `npx vitest run tools/marketing-kit` (1288 passed), `npx vitest run tools/marketing-kit/src/compose
  tools/marketing-kit/src/footage/compose.test.ts tests/repo` (774 passed), `npm run typecheck`, ESLint on the
  changed files, `npm run lint:language`. Approved.
