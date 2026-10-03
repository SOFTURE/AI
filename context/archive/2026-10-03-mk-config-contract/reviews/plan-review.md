# Plan review: mk-config-contract

Reviewed: plan.md @ 2026-10-03. Mode: deep (a contract every later item builds on; the riskiest claims
checked by hand). Verdict: ready after fixes.
Findings: 0 critical, 3 warning, 1 suggestion.
Grounding: 16/16 paths (`src/config/config.ts`, `src/film.ts`, `src/record/record.ts`,
`src/compose/{compose,timeline,site-tokens}.ts`, `src/render/render.ts`, `src/posts/posts.ts`,
`src/voice/voiceover.ts`, `src/cli/{main,films,voice,server,options}.ts`, `foundation/ui/src/theme/design-json.ts`,
`modules/analytics/src/options.ts`), 9/9 symbols (`loadMarketingConfig`, `validateFilm`, `isChannelCode`,
`readSiteTokens`, `cameraPose`, `composeFilm`, `recordFilm`, `buildPosts`, `voiceoverKey`), 4/4 commands
(`npm run typecheck|lint|test|build` from `workflow.json`).

## Riskiest claims

| Claim | Result |
| --- | --- |
| zod 4 generates a JSON Schema from strict objects with defaults and refinements | confirmed: `z.toJSONSchema(…, { io: "input" })` on a strict object with a default, a tuple and a `superRefine` gives `additionalProperties: false`, the default and `prefixItems`; refinements are dropped, as expected (scratch run) |
| An IANA timezone can be checked with `Intl.supportedValuesOf("timeZone")` | refuted: the list has no `UTC`; constructing `Intl.DateTimeFormat` throws `RangeError` on an unknown zone (scratch run) → W1 |
| The voiceover key stays FIRE's for `pl` when the language becomes a parameter | confirmed: the key hashes `{text, voice, model, lang}` (`voiceover.ts:55-60`); passing `"pl"` is the same input |
| A string `exports` entry for the JSON Schema passes the release rules | confirmed: `checkPackedFiles` only needs the target in the tarball (`scripts/release/release-rules.mjs:193-210`); `files` gains `schema` |

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS after W3 |
| Slicing | WARN (W2) |
| Verifiability | PASS |
| Data and migrations | PASS (none; the voiceover key is pinned) |
| Tests | PASS |
| Security | PASS (colours, families, selectors validated by shape before they reach CSS or HTML) |
| Lean | PASS (S1) |

## Findings

### W1 [WARNING] The timezone check as planned refuses `UTC`
**Effort:** low. **Lens:** Verifiability. **Where:** Key decisions, `brand` (plan.md)
**Problem:** `Intl.supportedValuesOf("timeZone")` has no `UTC` (scratch run), so a valid config would fail.
**Fix:** check by constructing `Intl.DateTimeFormat` with the zone.
**Decision:** Fix now (applied) - the `brand` row names the check.

### W2 [WARNING] The schema test needs the fixture before phase 3 writes it
**Effort:** low. **Lens:** Slicing. **Where:** Phase 1 tests, Phase 3 step 1 (plan.md)
**Problem:** "the fixture config validates" is a phase 1 test, but the fixture file was a phase 3 output.
**Fix:** phase 1 writes `examples/fixture/marketing.json`; phase 3 wires the scene, prepare and render.
**Decision:** Fix now (applied) - phase 1 files list it.

### W3 [WARNING] `social` is optional but the CLI always wrote posts
**Effort:** low. **Lens:** Coverage. **Where:** Phase 2 step 8 (plan.md) · `src/cli/main.ts:101-105`
**Problem:** `render` and `all` write `posts.md` unconditionally; with no post entry they would fail late.
**Fix:** skip `posts.md` with one line; `posts` fails naming the JSON path to add.
**Decision:** Fix now (applied) - step 8 says so.

### S1 [SUGGESTION] Phase 2 is one large commit
**Effort:** medium. **Lens:** Slicing. **Where:** Phase 2 (plan.md)
**Problem:** the model change breaks every caller at once, so the phase cannot be split into green commits
without temporary adapters.
**Fix:** keep it as one phase and commit; the value tests (poses, key) are the guard.
**Decision:** Accept risk - adapters would be throwaway code; accepted (auto).

## Triage summary
Fixed: W1, W2, W3. Accepted: S1. Deferred: -. Dismissed: -. Verdict after triage: ready.
