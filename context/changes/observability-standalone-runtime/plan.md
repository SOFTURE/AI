# Plan: observability-standalone-runtime

Input: change.md, issue #381 (research skipped, reason in change.md). Complexity: small (one phase).

## Goal

`registerObservability` starts observability in every Node.js server of a Next.js app, the standalone `server.js`
included, and still starts nothing in the edge runtime.

## Decisions (auto)

- **Detect the edge runtime, not the Node.js one.** `registerObservability` returns `null` when
  `process.env.NEXT_RUNTIME === "edge"` or when the `EdgeRuntime` global is defined; an unset variable is treated as
  Node.js. Both markers are what Next.js's edge sandbox sets, so either one alone is enough; checking both keeps the
  guard working if one of them changes.
- **Read the global through `globalThis`** (`"EdgeRuntime" in globalThis`), so the check needs no type declaration
  and cannot throw where the name is undeclared.
- **No version bump.** CHANGELOG gets an `## Unreleased` section (the release script turns it into the version).

## Phase 1: edge detection, tests, docs (test-first)

- Tests (`tests/next.test.ts`): with `NEXT_RUNTIME` unset the adapter starts (prints
  `observability: export disabled (no OTLP endpoint)`, returns a handle); with the `EdgeRuntime` global defined and
  `NEXT_RUNTIME` unset it returns `null` and prints nothing; the existing `edge` and `nodejs` cases stay.
- Code: `src/next/index.ts`, a small `isEdgeRuntime()` helper and the doc comment.
- Docs: README "What you get" line on the edge runtime and the standalone server; CHANGELOG `## Unreleased`.
- Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [ ] Phase 1: edge detection, tests, docs
