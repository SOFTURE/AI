# Implementation review: analytics-client-navigation

Scope: full · Date: 2026-10-03 · Commits: 3fc16bd..bcde444 · Gates: typecheck ✓ lint ✓ test ✓ (2234 tests, 25 skipped) · build ✓ · e2e ✓ (80/80, local Postgres)

## Verdict
Ready. A client navigation that lands without the channel parameter gets the remembered tag back in the browser,
proven by an e2e that strips `Next-Url` from every request and still reaches sign-up with the channel. One finding
fixed during implementation (F1), one accepted behaviour change documented (F2), one note for FU-7 (F3).

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | drift recorded in plan.md `## Decisions (auto)` |
| Progress honesty | PASS | - |
| Correctness | PASS | F1 (fixed) |
| Tests | PASS | - |
| Security | PASS (no new entry point; the browser rewrites only its own same-origin URL; nothing stored) | - |
| Patterns and lessons | PASS (L-001 `"use client"` kept by tsc; L-002 bare `next/navigation` typed in `next-modules.d.ts`) | - |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: The keeper, the component and the docs | bcde444 | yes | client part in `src/next/`, own entry point (F1) |

Files: planned 14, changed 16. Unplanned: `modules/analytics/package.json` (the `./next/channel-keeper` export),
`src/server/options.ts` and `src/server/index.ts` (`getChannelRule`), all from F1. Planned, not changed:
`src/ui/channel-keeper.tsx`, `src/ui/index.ts` (NFR-3 lint rule; the component lives in `src/next/`). Existing test
cases: none edited or removed (only header comments and import lines changed), as plan review W2 required.

## Findings

### F1 [FIXED] Exporting the keeper from `/next` broke `softure migrate`
**Where:** `modules/analytics/src/next/index.ts`, `examples/next-app/softure.config.ts:4`
**Problem:** `softure.config.ts` imports `@softure-ai/analytics/next` and `softure migrate` loads it in plain Node,
which cannot resolve the bare `next/navigation` the client part imports (Next has no `exports` map). Unit tests passed
because Vite resolves it.
**Fix:** `<ChannelKeeper />` moved to its own entry point `@softure-ai/analytics/next/channel-keeper`;
`getChannelRule` to `/server`. A test walks the source graph of `/next` and fails if it reaches `next/navigation`
(checked red with the export put back).

### F2 [ACCEPTED] The keeper restores a tag the page removed with `replaceState`
**Where:** `modules/analytics/src/client/channel-keeper.ts`
**Why accepted:** the same rule as the proxy (only another tag, or an invalid value, ends the chain); README §12 says so
and an e2e pins it.

### F3 [NOTE] Overlap with FU-7
A server action's redirect is a router navigation, so the keeper tags its target in the browser before the page's
beacon runs; `analytics-funnel.spec.ts` now counts the account view after sign-up under the channel. FU-7 keeps the
server render of the redirect target (`getChannelFromSearchParams`, clients without JavaScript). No new gap: nothing
here needs a new FU item.
