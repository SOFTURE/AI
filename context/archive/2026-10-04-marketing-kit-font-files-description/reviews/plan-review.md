# Plan review: marketing-kit-font-files-description

Reviewed: plan.md @ 2026-10-04. Mode: standard. Verdict: ready.
Findings: 0 critical, 0 warnings, 1 suggestion.
Grounding: 2/2 paths, 4/4 symbols (`fontSchema`, `fontFaces`, `OgFontFamily.subsetFamilies`, `toFontFamilyCss`),
1/1 command (`npm run schema -w @softure-ai/marketing-kit`); the old text appears only in `schema.ts` and twice in
`schema/marketing.schema.json` (grep).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (weights and styles, several subset files, listed order for OG, `unicodeRange` for the film, regenerated schema) |
| Slicing | PASS (one phase) |
| Verifiability | PASS (drift test, grep for the old text) |
| Data and migrations | PASS (none) |
| Tests | PASS (the drift test covers a generated file; no behaviour to test) |
| Security | PASS (text only) |
| Lean | PASS |
| Fit | PASS (README §OG images uses the same Fontsource example; no FIRE font names) |
| Cost and defaults | PASS (no config changes meaning) |
| Scope | PASS (README and other keys excluded) |
| Reuse | PASS |
| Lessons | PASS (no regexes added) |
| Progress format | PASS |

## Findings

### S1 [SUGGESTION] Say why each subset file needs its unicodeRange in the film
**Effort:** low. **Lens:** Fit. **Where:** Approach, Chosen
**Problem:** in the film all files of a weight are `@font-face` rules of one family; where their ranges overlap
(no `unicodeRange` means all characters), the browser checks the last declared rule first, so a subset file
without a range shadows the earlier one for every character it has.
**Fix:** the chosen text already says "each with its unicodeRange" next to the subset example, and the
`unicodeRange` key's own description says "without it, all of them". Accepted as is: no change.

## Verdict
Ready.
