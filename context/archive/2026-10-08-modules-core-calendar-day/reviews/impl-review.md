# Implementation review: modules-core-calendar-day

Reviewed: the branch diff against `plan.md` (D1-D5, Phase 1) and the plan review's accepted finding.

Verdict: **approve** (no open blocking findings; one finding fixed in the change, one recorded).

## Plan conformance

- D1: `getDayInZone` (blog `/pages`, also re-exported by `/server`) and `getLocalDate` (blog `/quality`) keep
  their names and signatures and return `toCalendarDay(moment, zone)`.
- D2: mcp-access and billing `getDayNumber` read `Date.parse(\`${day}T00:00:00Z\`) / DAY_MS` from
  `toCalendarDay`; billing keeps `getLocalWallTime` for `getStartOfDay`, its formatter on `en-US` read by part
  type. `grep -rn "en-CA" modules --include=*.ts` is empty; the only hit under `foundation/` is core's comment
  explaining why it avoids the pattern.
- D3: core 0.1.7, blog 0.1.10 (`package.json`, `module.json`, the manifest in `src/index.ts`), entries in the
  unreleased 0.1.9 of privacy, mcp-access and billing; the four ranges are `^0.1.7`; lockfile regenerated.
- D4: new tests in `modules/blog/tests/pages/listing.test.ts`, `modules/blog/tests/quality/settings.test.ts` and
  `modules/privacy/tests/export-file-name.test.ts` (F1: `getFileName` exported from `route.ts` only; the `/next`
  index still re-exports `exportRoute` alone). Sabotage run: every `toCalendarDay` call switched to `"UTC"` made
  15 tests fail across the five files (the new ones and the existing billing and mcp-access tests); restored, all
  56 pass.
- D5: implemented after #272 was merged; master merged into the branch.

## Findings

### I1 (Suggestion, fixed): a touched file named the app it came from
`modules/mcp-access/src/token-status.ts` opened with a reference to an adopting app's source file. The header
now describes the function on its own terms (neutral wording rule for the repository).

### I2 (Suggestion): one more `Intl` call per day number in billing — recorded
`getDayNumber` now formats through core's cached formatter instead of billing's own; both are one cached
`Intl.DateTimeFormat` per zone, so the cost is the same. No change.

## Gates

typecheck, lint (with the language gate), `npm test` and `npm run build` green on 880910b1.
