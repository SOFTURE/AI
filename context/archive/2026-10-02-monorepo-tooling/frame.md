# Frame: monorepo-tooling

## Request as stated

FD-1 Outcome: root `npm ci && npm run typecheck && npm run lint && npm test` over all workspaces;
each package builds ESM + `.d.ts` **(tsup)** and, where it has styles, compiled CSS; a package
template; lefthook hooks mirroring FIRE_TRACKER; CI; repository tests from day one.

## Problem → outcome → proposed solution

- Problem: nothing guards the repository; packages that FD-3…FD-7 write would ship untyped,
  unlinted, untested, and with Polish slipping into code.
- Outcome: every package publishes typed ESM that a Next 16 app consumes as is, and every commit,
  push and PR passes the same gates.
- Proposed solution: tsup for builds, lefthook + CI for gates, repository tests.

## Premise check

- Do nothing for 3 months: FD-2…FD-8 cannot start (all depend on FD-1); the whole foundation stalls.
- Evidence: the gates and the hooks are not in question. The build mechanism is: tsup 8.5.1
  removed `"use client"` and `"use server"` from bundled output without a warning, and its `.d.ts`
  step failed on TypeScript 6.0 (research.md, Answers 1). tsup's README marks it unmaintained.
- Already solved elsewhere: `tsc` emits ESM and declarations per file and keeps directives; the
  repo needs `tsc` for typecheck anyway. CSS is a separate tool in docs/02 §12 (Tailwind CLI).
- Smallest proof: build `templates/package/` with `tsc -p tsconfig.build.json` in a repository
  test and assert `dist/index.js` and `dist/index.d.ts`.

## Framings

| Option | What we build | Cost vs as-asked | Risk |
|---|---|---|---|
| Proceed (tsup) | tsup config per package, dts through tsup | same | directives dropped in every package with a Next adapter; DTS broken on TS 6; dead dependency |
| Reframe (tsc) | `tsconfig.build.json` per package, `tsc -p` | cheaper: one tool fewer, no bundler config | relative imports need explicit `.js` extensions (NodeNext enforces it at typecheck) |
| Reuse (tsdown) | tsdown, the tsup successor | similar to as-asked | pre-1.0 (0.23), bundles too, so directives still need care |
| Shrink | gates only, builds deferred to FD-3 | cheaper now | FD-2 needs a build to pack; every later item re-decides |

## Decision

**Reframe (tsc)** — because it is the only option that keeps per-file `"use client"` /
`"use server"` directives without extra plugins, and the repo already depends on `tsc`.

Scope now: everything in the Outcome, with "builds ESM + `.d.ts` (tsup)" delivered by `tsc`.
docs/02 §12's build line is updated to match. Out of scope now: the CSS build (FD-5 owns the
`styles.css` pipeline), bundling for the container migrate step (FD-4 / ID-7 bundle with esbuild
where they need a single file).

## Decisions (auto)

- tsup → tsc (the deciding argument above; the Outcome's user-visible result, typed ESM per
  package, is unchanged, so `change.md` Intent keeps its wording and this file records the swap).
- Kill was never a candidate: every other foundation item depends on FD-1.
