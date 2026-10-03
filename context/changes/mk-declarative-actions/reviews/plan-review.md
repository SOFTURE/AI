# Plan review: mk-declarative-actions

Reviewed: plan.md @ 2026-10-03. Mode: deep (a contract projects and agents write by hand; the riskiest
claims checked in scratch runs). Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 9/9 paths (`src/film.ts`, `src/record/record.ts`, `src/config/{schema,config,issues}.ts`,
`src/cli/{films,main}.ts`, `tests/render.test.ts`, `examples/fixture/marketing.json`), 8/8 symbols
(`Director`, `recordFilm`, `ScreenGuardError`, `loadFilm`, `findMissingFiles`, `formatIssues`,
`splitIntoBeats`, `getWords`), 4/4 commands (`npm run typecheck|lint|test|build` from `workflow.json`).

## Riskiest claims

| Claim | Result |
| --- | --- |
| One validated descriptor object gives an error per key | confirmed for a lone descriptor and inside an array (`0.target.1: Unrecognized key "txt"`, scratch run, zod 4.6.5) |
| `target` as "one descriptor or an array" keeps those errors | refuted: `z.union([descriptor, z.array(descriptor)])` reports `0.target: Invalid input` for a bad lone descriptor (scratch run) → W1 |
| The JSON Schema accepts both target forms and survives the transform | confirmed: `z.toJSONSchema(…, { io: "input" })` emits `anyOf: [object, array]` with the descriptor's input shape (scratch run) |
| A static `until` check agrees with the Director | confirmed: the voiceover words are the sentence split on whitespace (`src/voice/voiceover.ts:154`), and both strip `.,?!:;` (`record.ts:247`, `schema.ts` `getWords`) |
| `first()` and `nth(0)` find the same element | confirmed by Playwright's docs (`first()` is `nth=0`); the log has no locator strings, so FIRE's `.first()` maps to `nth: 0` |

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS (S1) |
| Verifiability | WARN (W1, W2) |
| Data and migrations | PASS (none; `sceneModule` videos unchanged) |
| Tests | PASS |
| Security | PASS (`fill.input` is an identifier; regexes are the project's own config, compiled once) |
| Lean | PASS |

## Findings

### W1 [WARNING] A misspelt key in a one-or-many target reads "Invalid input"
**Effort:** low. **Lens:** Verifiability. **Where:** Key decisions, Descriptor (plan.md)
**Problem:** zod 4 unions report only `invalid_union` when every branch fails; the goal says every
mistake names its key.
**Fix:** `expandUnionIssues` in `src/config/issues.ts` replaces such an issue with the issues of the only
branch that matched the input's type; a phase 1 test pins it.
**Decision:** Fix now (applied) - a Key decisions row, phase 1 step 2 and a test.

### W2 [WARNING] Strict mode makes an ambiguous locator fail only while recording
**Effort:** low. **Lens:** Verifiability. **Where:** Key decisions, Without `nth` (plan.md)
**Problem:** a text that matches two elements cannot be caught at load time; the author learns it from a
recording error.
**Fix:** the runtime error names the action's JSON path and Playwright's "resolved to N elements" line;
the README tells authors to add `nth`.
**Decision:** Fix now (applied) - phase 3 step 4 names it.

### S1 [SUGGESTION] Phases 1 and 2 may share a commit
**Effort:** low. **Lens:** Slicing. **Where:** Phase 1 step 5 (plan.md)
**Problem:** removing `sceneModule` from `VideoConfig` touches the CLI in phase 1.
**Fix:** phase 1 makes the CLI compile with module scenes only; if the hook's typecheck forces it, the
two phases land together, as MK-2 did.
**Decision:** Accept risk - accepted (auto).

## Triage summary
Fixed: W1, W2. Accepted: S1. Deferred: -. Dismissed: -. Verdict after triage: ready.
