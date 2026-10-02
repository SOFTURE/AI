# Plan review: ui-tokens-theme

Mode: auto. Reviewed: plan.md (3 phases), against change.md, research.md and L-001.

Grounding: 9/9 existing paths (`templates/package/`, `foundation/core/{package.json,tsconfig.build.json,src/i18n.ts,src/result.ts}`,
`tests/repo/packages.test.ts`, `scripts/check-language.mjs`, `vitest.config.mts`, `docs/02-module-standard.md`),
4/4 core symbols (`Locale`, `DeepPartial`, `Dictionaries`, `Result`), 3/3 gate commands from `workflow.json`.

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS after F3 (design.json input on the provider was underspecified) |
| Slicing | PASS after F2 |
| Verifiability | PASS |
| Data and migrations | PASS (none) |
| Tests | PASS |
| Security | PASS: token values are validated before reaching `<style>`; no entry points |
| Lean | PASS |
| Fit | PASS: package shape copies core; Result and zod as in core |
| Cost and defaults | PASS |
| Scope | PASS: switch only, no primitives |
| Reuse | PASS: core messages and Result reused |
| Lessons | PASS: L-001 (`tsc` first, `"use client"` survives, criterion 2.1) |
| Progress format | PASS after F1 |

## Findings

1. **WARNING, low effort.** Phase 2 Files named `soft-theme-provider.tsx` while step 2 names
   `softure-theme-provider.tsx`, and listed `architecture.test.tsx` while step 5 says `.ts`.
   Fix: one spelling each. **Applied.**
2. **WARNING, low effort.** Phase 1 declared `./styles.css` and `./tailwind.css` exports whose files
   only exist after phase 3, so phase 1 would ship exports that resolve to nothing (FD-1 research
   rejected exactly this). Fix: add the CSS exports in phase 3 with their build. **Applied.**
3. **WARNING, low effort.** The provider "accepts `theme` or `design`" without saying how they combine
   or what an invalid `design` does. Fix: `design` first, `theme` overrides per token, invalid
   `design` throws a named error; tests added. **Applied.**

## Verdict

ready (all findings applied).
