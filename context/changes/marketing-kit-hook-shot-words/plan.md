# Plan: marketing-kit-hook-shot-words

Input: change.md, research.md. Complexity: small.

## Goal
`marketing.json` with a `videos[i].hook.shots[j]` entry (j ≥ 1) without `word` is refused when it loads, on the
path `videos[i].hook.shots[j].word`, with a message that says why the word is needed. Configs whose later shots
name a word load as before.

**Out of scope:** refusing a word on the first shot (accepted and ignored, as today); compose changes (its throw
stays as a second line for callers that bypass the loader); other schema keys (FU-15); publishing.

## Approach
**Starting point:** the video `superRefine` loop over `hook.shots` (research §Summary).

**Chosen:** in that loop, add an issue on `["hook", "shots", index, "word"]` when `index > 0` and `word` is
undefined, message `every shot after the first needs the word of the first sentence it starts on`. Keep the
existing membership check for given words.
Rejected: a zod tuple / `prefixItems` schema for the first shot - changes the inferred types and the generated JSON
shape for a rule the description already carries; checking in `config.ts` after parsing - the schema is where every
other path-named check lives.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where | video `superRefine` | the shot-word check already lives there and gets the `videos[i]` prefix | research §Summary |
| First shot's word | still accepted | outcome names shots after the first only | roadmap FU-19 |
| JSON Schema | unchanged unless the description changes | the description already states the rule | research §Summary |
| Version bump | none | the package is unpublished `0.0.0` (MK-8 publishes) | plan |

## Phase 1: Later opening shots need a word at load
**Discipline:** TDD. **Files:** `tools/marketing-kit/src/config/schema.ts`, `tools/marketing-kit/tests/config.test.ts`,
`tools/marketing-kit/README.md`

1. Test first: in `tests/config.test.ts` table "refuses %s, naming its path", a case pushing a third shot without a
   word expects `videos[0].hook.shots[2].word: every shot after the first needs the word of the first sentence it
   starts on`. A separate `it` loads `makeConfig()` with `hook.shots` reduced to the first shot and asserts the loaded
   shots exactly (`[{ mark: "age", scale: 1.6 }]`: a one-shot opening needs no word; plan review W1). Run: the
   refusal fails.
2. `schema.ts`: the condition in the video `superRefine`.
3. `README.md`: the load-time check list names a later opening shot without a word.
4. Run `npm run schema -w @softure-ai/marketing-kit`; the schema drift test confirms the file is unchanged or
   commits the regenerated one.

**Done when:**
- Automated: the new config tests pass and failed before step 2.
- Automated: `tests/schema.test.ts` passes (drift and descriptions).
- Automated: Gates green (typecheck, lint, test) and `npm run build`.

## Risks and rollback
- Only configs that would fail at compose are newly refused.
- Rollback: revert the phase commit.

## Decisions (auto)
- Complexity → small (one refinement, one test table, one README line).
- Framing skipped (change.md Notes).
- Plan review: W1 applied to step 1; S1 accepted without change.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Later opening shots need a word at load

#### Automated
- [ ] 1.1 The new config tests pass and failed before the schema change
- [ ] 1.2 `tests/schema.test.ts` passes on the regenerated file
- [ ] 1.3 Gates green (typecheck, lint, test) and build
