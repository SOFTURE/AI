# Implementation review: marketing-kit-hook-shot-words

Scope: full · Date: 2026-10-04 · Commits: 762ccc3..7a7e04b · Gates: typecheck ✓ lint ✓ test ✓ (2422 tests, 29 skipped) · build ✓

## Verdict
Ready. A `videos[i].hook.shots[j]` entry with `j ≥ 1` and no `word` is refused when `marketing.json` loads, on
`videos[i].hook.shots[j].word`, with "every shot after the first needs the word of the first sentence it starts on".
A one-shot opening without a word still loads. No blocking finding; one suggestion recorded.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS | - |
| Tests | PASS | - |
| Security | PASS (local config file, no entry point, no secrets) | - |
| Patterns and lessons | PASS | F1 |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Later opening shots need a word at load | 7a7e04b | yes | the refusal test failed before the schema change (verified) |

Files: planned and changed 3 · unplanned 0 · planned, not changed 0 (`schema/marketing.schema.json` regenerated
byte for byte: the shot `word` description already said when it is required).

## Correctness notes
- The check sits in the same `superRefine` loop as the membership check, so both issues can be reported for
  different shots in one load; a missing word never also triggers the membership check (`word !== undefined`).
- `composeFilm` keeps its throw for a later shot without a word: callers that build a `MarketingConfig` without the
  loader still get a named error. For loaded configs it is now unreachable.
- The fixture project and `tests/actions-schema.test.ts` give their second shot a word and load unchanged.

## Findings

### F1 [SUGGESTION] The JSON Schema cannot flag the missing word in an editor
**Where:** `tools/marketing-kit/schema/marketing.schema.json`, `hook.shots`
The editor sees `word` as optional on every shot; only the description says otherwise. Expressing "required from
the second item" needs `prefixItems` plus `items`, which zod does not emit for an array of one shape. The load-time
check is the outcome the roadmap asks for. Accepted as is; not a gap worth an FU item.
