# Plan: deps-security-audit-2026-11

## Phases

1. Bump `next` (root, `examples/next-app`), `happy-dom` to 21.x, `vite`; raise `markdown-it` in
   `@softure-ai/blog` with a changelog entry; add root `overrides` for `fflate` and `minimatch`; refresh the lockfile
   for zod, undici, puppeteer-core. Evidence: `npm audit` reports 0 vulnerabilities; typecheck, lint, the full test
   suite and the build are green; CI on the pull request is green.

## Acceptance

- `npm audit` exits 0 (command and output recorded below).
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green locally; PR checks green.

## Decisions (auto)

- One phase: every bump shares `package-lock.json`, so splitting adds conflicts and no safety.
- If `happy-dom` 21 or `minimatch` 11 break a gate, fix the call site in this change when small; otherwise keep the
  old version and name the residual advisory in the issue.

## Progress

- [x] p1 bumps, overrides, lockfile; `npm audit` -> `found 0 vulnerabilities` (root and `examples/next-app`).
  Fallout fixed in the same phase: markdown-it 15.0.3 ships its own types, so `@softure-ai/blog` drops
  `@types/markdown-it` and `@types/markdown-it-footnote` and declares the footnote plugin itself; zod 4.6.6+ aborts a
  union branch on a failed `.max`, so `@softure-ai/analytics` checks the `channelField` upper bound in its
  `superRefine` (reproduced against zod 4.6.6 and 4.6.7). Gates: typecheck green, lint green (8 GB heap as in CI),
  language gate green, `npm run build` green, `npm test` 786 files passed; the two other red files pass on re-run:
  `deploy-workflows.test.ts` after installing `openssh-client`, `finish.test.ts` alone (load-sensitive, see #1095).
