# Plan review: mk-og-images

Reviewed: plan.md @ 2026-10-03. Mode: standard (small change, no data, no money).
Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 6/6 paths (`src/config/schema.ts`, `src/config/config.ts`, `src/cli/main.ts`, `src/cli/options.ts`,
`src/index.ts`, `tests/repo/packages.test.ts`), 5/5 symbols (`ogImageSchema`, `marketingSchema`,
`loadMarketingConfig`, `COMMANDS`, `isHexColor`), 4/4 commands (`npm run typecheck|lint|test|build`
from `workflow.json`; `npm run schema -w @softure-ai/marketing-kit`).

## Riskiest claims

| Claim | Result |
| --- | --- |
| The `./og` entry can avoid Playwright | confirmed: the config chain imports Playwright only as types (`src/film.ts:1`, `import type`); `src/record/record.ts:4` is the only runtime import and `src/og/` will not reach it |
| A union on `template` keeps the JSON Schema generator working | confirmed in principle: zod 4 `discriminatedUnion` of strict objects emits `oneOf`/`anyOf` in `z.toJSONSchema`; the drift test (`tests/schema.test.ts`) will show it |
| Satori silently falls back on an unloaded weight | confirmed by measurement (research table) |
| An extra export passes the package shape test | confirmed: `tests/repo/packages.test.ts:97-110` requires source → types → default and an existing `./src/…ts` file |

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (every roadmap bullet maps to a goal line) |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | PASS (no data; `ogImages` entries without behaviour cannot exist in a project yet) |
| Tests | PASS after W1 |
| Security | PASS after W2 (chart path characters restricted; no markup reaches the SVG) |
| Lean | PASS (S1) |

## Findings

### W1 [WARNING] Alpha derivations assume `#rrggbb`
**Effort:** low. **Lens:** Tests. **Where:** Key decisions, Palette (plan.md) · `src/config/colors.ts:41` (`HEX_COLOR` accepts 3, 4, 6 and 8 digits)
**Problem:** appending an alpha to `#abc` or `#rrggbbaa` gives an invalid colour.
**Fix:** normalise to `#rrggbb` before deriving `surface` and `border`; test all three spellings.
**Decision:** Fix now (applied).

### W2 [WARNING] A route's `data` override must be validated
**Effort:** low. **Lens:** Security. **Where:** Phase 1 step 5 (plan.md)
**Problem:** a Next route may build `data` from request input; unvalidated, it could carry long text or
markup-shaped chart paths.
**Fix:** the override goes through the template's schema, and a test refuses an invalid one.
**Decision:** Fix now (applied).

### S1 [SUGGESTION] No dedicated architecture test for Playwright imports
**Effort:** low. **Lens:** Lean. **Where:** Phase 1 tests (plan.md)
**Problem:** a separate architecture file is more machinery than the rule needs.
**Fix:** one test in `tests/og/` that reads `src/og/**` and refuses `playwright` and `../record/` imports.
**Decision:** Fix now (that is how the plan words it).
