# Plan review: marketing-kit-schema-docs

Reviewed: plan.md @ 2026-10-03. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 2 suggestion.
Grounding: 7/7 paths, 6/6 symbols (`marketingSchema`, `getMarketingJsonSchema`, `relativePath`, `COLOR_ROLES`/`ColorRole`, `SFX_EVENTS`/`SfxEvent`, `DEFAULT_LINK_IN_BIO`), 2/2 commands (`npm run schema -w @softure-ai/marketing-kit`, gates from `workflow.json`)

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (none) |
| Tests | PASS after W1 |
| Security | PASS (no entry point) |
| Lean | PASS |
| Fit | PASS |
| Cost and defaults | PASS (no default changes) |
| Scope | PASS |
| Reuse | PASS |
| Lessons | PASS (none apply) |
| Progress format | PASS |

Deep checks (done by the reviewer, not delegated: one package, few claims):
- "Descriptions survive `.default()`/`.prefault()`/`.optional()`": confirmed by the research probe on zod 4.6.5.
- Blast radius of `.describe()` on shared constants: `id` is used by videos, beats, screenshots, OG images and posts
  (`schema.ts:236`, `251`, `300`, `311`, `325`); `nonEmpty` by many keys. The plan's key decision (describe at the use
  site) covers it.
- Discriminated union with described literals: `actions-schema.test.ts:134` and `:154` prove parsing and the unknown-`do`
  message; see S1.

## Findings

### W1 [WARNING] The guard's own failure path was a one-off manual check
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, Done when, first bullet (plan.md)
**Problem:** "fails when one description is removed (checked once by hand)" sat in the Automated group, but nothing
re-checks it; a walker that silently skips `oneOf` branches or record values would pass on any schema.
**Fix:** a named `findUndescribedKeys` helper tested on an inline schema (bare key, bare key in a `oneOf` branch, bare
record value, blank description), then applied to the committed file.
**Decision:** Fix now (applied) - step 1 and the Done-when/Progress items 1.1-1.2 rewritten.

### S1 [SUGGESTION] Name the test that proves described `do` literals still discriminate
**Effort:** low. **Lens:** Tests. **Where:** Approach, Critical details
**Problem:** `.describe()` clones the literal inside `z.discriminatedUnion`; the plan relied on "existing tests" in general.
**Fix:** name the two tests in `actions-schema.test.ts` in Critical details.
**Decision:** Fix now (applied).

### S2 [SUGGESTION] README tables duplicate the descriptions
**Effort:** medium. **Lens:** Lean. **Where:** Out of scope
**Problem:** the README configuration and action tables now say what the schema says; two texts can drift.
**Fix:** generate the README tables from the descriptions later, or accept the overview as a summary.
**Decision:** Defer - not a gap worth a FU item now; the README is an overview with links, the schema is the reference.

## Triage summary
Fixed: W1, S1. Accepted: -. Deferred: S2. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- W1 The guard's own failure path → Fix now (clear, cheap fix).
- S1 Name the discriminating tests → Fix now (cheap).
- S2 README duplication → Defer (outside the roadmap outcome; the README stays an overview).
