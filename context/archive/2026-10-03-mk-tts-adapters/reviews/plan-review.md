# Plan review: mk-tts-adapters

Reviewed: plan.md @ 2026-10-03. Mode: standard (small change; money is the only real risk).
Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 6/6 paths (`src/voice/voiceover.ts`, `src/cli/voice.ts`, `src/cli/main.ts`, `src/config/config.ts`,
`src/index.ts`, `examples/fixture/prepare.ts`), 6/6 symbols (`voiceoverKey`, `buildTtsRequest`,
`readTimestampsResponse`, `wordsFromAlignment`, `produceVoiceover`, `requireVoiceover`), 4/4 commands
(`npm run typecheck|lint|test|build` from `workflow.json`).

## Riskiest claims

| Claim | Result |
| --- | --- |
| The kit already uses `{ ok, … }` results, so a local result type fits | confirmed: `LoadConfigResult` (`config.ts:90`) |
| FIRE's cache needs no re-keying | confirmed: the key hashes `{text, voice, model, lang}` (`voiceover.ts:50-55`); the pinned test covers `pl` |
| `voiceoverKey` keeps its positional signature | confirmed needed: `examples/fixture/prepare.ts:55` and `cli/voice.ts:22` call it positionally |
| The fixture can run a dry run without a key | confirmed: `marketing.json` sets `voice.cacheDir: "voiceover"`; without `prepare.ts` the cache is empty, so `voice` takes the dry-run path |

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS after W1 |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | PASS (no data; the cache key is pinned) |
| Tests | PASS after W2 |
| Security | PASS (the key is read from the environment and never logged; error bodies are cut to 300 characters) |
| Lean | PASS (S1) |

## Findings

### W1 [WARNING] `all` must show the estimate on a cache miss too
**Effort:** low. **Lens:** Coverage. **Where:** Phase 2 step 1 (plan.md) · `src/cli/main.ts:170`
**Problem:** `all` calls `produceVoiceover(…, false)` and fails on null; the plan's outcome for it was implicit.
**Fix:** the dry-run outcome logs the estimate in both callers; `all` then fails with "no voiceover" as today.
**Decision:** Fix now (applied) - the goal says "in every dry run".

### W2 [WARNING] The API key must not leak into errors or logs
**Effort:** low. **Lens:** Tests. **Where:** Phase 1 tests (plan.md)
**Problem:** an error path that prints the request (headers) would print the key.
**Fix:** a test asserts no logged line or error contains the key.
**Decision:** Fix now (applied) - added to the elevenlabs tests below.

### S1 [SUGGESTION] A model-specific credit table
**Effort:** medium. **Lens:** Lean. **Where:** Key decisions, Estimate (plan.md)
**Problem:** Flash models cost less per character on some plans; the estimate is an upper bound.
**Fix:** none now; the line says "at most".
**Decision:** Accept risk - plan prices change and an upper bound never under-reports; accepted (auto).

Applied to the plan: elevenlabs tests also check that the key appears in no error message.
