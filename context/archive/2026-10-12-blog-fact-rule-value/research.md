---
change_id: blog-fact-rule-value
---

# Research: fact rule value and year (issue #379)

## Today (master `8159def`)

- `modules/blog/src/quality/facts.ts`: `factRuleSchema` (`id`, `description`, `patterns`, `allowedValues(year)`,
  `unit`, `expires`, `severity`); `isFactSentence` tests the patterns with `String.search`, so a `g` flag does no harm.
- `modules/blog/src/quality/rules/facts.ts`: `checkFacts` splits every non-heading prose block into sentences; for a
  matching rule `readSentence(sentence, notation)` returns the first number that is not a year (1900-2100, four
  digits) nor after a legal reference, and the first year. The year falls back to `current_as_of`. An empty or
  undefined `allowedValues(year)` skips the sentence. A mismatch is one finding with the rule's severity.
- `refresh.ts` uses only `isFactSentence` and `getFactChangeDay`; it does not read values, so it is untouched.
- Severities: `QUALITY_SEVERITIES = ["error", "warning"]`; `quality.severity[id]` overrides a finding's severity
  (`getEffectiveSeverity`), "off" drops it.
- Tests: `tests/adoption-gaps-318.test.ts` ("fact rules (#318, 2)") pins the current reading on the model text
  (`tests/quality/fixtures/index-funds.txt`, line 22 "Most broad index funds charge between 0.03% and 0.2% a year").
- Docs: README "Fact rules", CHANGELOG 0.1.11 entry (#318).

## Findings

- A pattern with a capture group gives the exact place of the value; reading the first number inside group 1 (with
  the ruleset's notation) also covers a group that captures more than the number ("40,000 PLN").
- `String.search` ignores groups; `RegExp.prototype.exec` with the pattern's flags minus `g`/`y` gives group 1
  without touching `lastIndex` of the app's regex.
- Checking every year of the sentence is strictly more lenient for a value quoted once with several years ("from 2025
  to 2026 the limit is ..."); it cannot turn a passing sentence into a failing one.
