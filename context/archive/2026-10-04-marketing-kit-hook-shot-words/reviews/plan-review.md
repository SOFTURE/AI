# Plan review: marketing-kit-hook-shot-words

Reviewed: plan.md @ 2026-10-04. Mode: standard. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 3/3 paths, 4/4 symbols (`videoSchema` `superRefine`, `getWords`, `loadMarketingConfig`, `makeConfig`),
1/1 command (`npm run schema -w @softure-ai/marketing-kit`); `composeFilm`'s camera loop reads `shot.word` only for
`index > 0` (`src/compose/compose.ts`, camera section), which the plan's first-shot decision relies on.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (path, load time, description; matches the roadmap outcome) |
| Slicing | PASS (one phase) |
| Verifiability | PASS (exact message asserted by path) |
| Data and migrations | PASS (none) |
| Tests | WARN (W1) |
| Security | PASS (local config file, no entry point) |
| Lean | PASS |
| Fit | PASS after S1 |
| Cost and defaults | PASS (only configs that fail at compose today are refused) |
| Scope | PASS (FU-15 and compose excluded) |
| Reuse | PASS (same loop, same path convention) |
| Lessons | PASS (no lazy regexes over CSS: none added) |
| Progress format | PASS |

## Findings

### W1 [WARNING] The one-shot case belongs outside the refusal table
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, step 1
**Problem:** step 1 puts "a one-shot opening without a word loads" next to the refusal cases, but the table
`refuses %s, naming its path` asserts an error. The boundary case would either fail for the wrong reason or be
dropped.
**Fix:** a separate `it` that loads `makeConfig()` with `hook.shots` reduced to the first shot and asserts the
loaded shots exactly (`[{ mark: "age", scale: 1.6 }]`).

### S1 [SUGGESTION] Name the shot's mark in the message
**Effort:** low. **Lens:** Fit. **Where:** Approach, Chosen
**Problem:** the path already locates the shot; the compose error named the mark, which is what the author sees in
the config.
**Fix:** keep the planned sentence; the path suffices and matches the sibling message style
(`"<word>" is not a word of the first sentence`). Accepted as is: no change.

## Verdict
Ready after W1 (applied to plan.md step 1).
