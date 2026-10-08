# Implementation review: marketing-kit-satori-crash

Reviewed: the branch diff against plan.md (Phase 1, D1–D4) and issue #254.

Verdict: **approve** (no blocking findings).

## Against the plan

- D1: `src/cli/main.ts` no longer imports `./og.js` at the top; the `og` branch loads it with `await import("./og.js")`.
  Matches.
- D2: `dependencies.satori` is `"0.35.1"`; the lockfile moves from 0.35.0 to 0.35.1. Matches.
- D3: `tests/satori-isolation.test.ts`, three cases (no satori in the CLI's static graph, satori reachable from
  `cli/og.ts`, exact pin). Seen red before the code (2 of 3 failing; the `og.ts` case passes on both sides by
  design, it proves the walker), green after.
- D4: CHANGELOG `0.1.10`, README `npx` example shows 0.1.10, `package.json` 0.1.10. Matches.

## Real check

Built CLI, fixture `marketing.json`, `softure-marketing posts fixture-tour` with satori 0.35.2 swapped into
`node_modules`: before the change the process died with the satori `__dirname` error (exit 1); after it, the
command wrote `posts.md` (exit 0). With 0.35.1 installed the kit's suite is green (539 passed, OG render tests
included).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Suggestion | The walker in the test is a regex over source lines, not a TypeScript parse. It reads every `import … from`/`export … from` of the kit's own sources, which only use that form; a future multi-line `import type {…}` block is skipped correctly by `(?!type\b)`. Good enough for a guard; a real parse would add a dependency for no gain. | No change. |
| 2 | Check | The root entry still re-exports the OG API (out of scope, breaking to remove); with the exact pin it loads a working satori. | No change. |
| 3 | Check | Error handling: a failed dynamic import rejects inside `main`, which the existing `.catch` reports and exits 1, as before. | No change. |

## Gates

`npm run typecheck`, `npm run lint`, `npm run build` green; the kit's tests green; full `npm test` runs in
`pre-push`.
