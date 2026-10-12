---
change_id: blog-fact-rule-value
status: planned
---

# Plan: fact rules read a captured value, every year, warn on an unknown year (issue #379)

Input: change.md, research.md. Complexity: small (one rule of one package).

## Decisions (auto)

1. **Captured value.** A pattern with a capture group says where the value stands: among the matching patterns that
   have a group, the first one whose group 1 holds a number gives the value (its first number, years and legal
   references skipped, as today). A capturing pattern whose group 1 holds no number or does not take part leaves the
   sentence unchecked: the app said where the value is, and nothing is there. When no matching pattern has a group,
   the value is the first number of the sentence (today). Taken from the issue's proposal; a "first number after the
   keyword" default would change today's results for every existing rule.
2. **Every year.** The sentence's years are all distinct years in it (else the year of `current_as_of`). The value
   passes when it is one of the values of any of those years. Years whose values are unknown are ignored when another
   year is known. A mismatch message names every known year with its values. Not opt-in: it only makes a sentence with
   several years more lenient, never stricter.
3. **Unknown year.** `onUnknownYear: "warn" | "skip"` on the rule, default `"skip"`. With `"warn"`, a sentence none of
   whose years has values gives a finding of the rule's id with severity `"warning"` (whatever the rule's
   `severity`; `quality.severity` still overrides it): "<description>: no value known for 2031, 40,000 not checked".
4. `refresh` is unchanged: it lists texts by sentence match, not by value.

## Phase 1: tests and implementation

One phase: the tests use `onUnknownYear`, which does not type-check before the schema has it, and the pre-commit hook
runs typecheck. The tests were run red against the unchanged rule first (7 of 11 failed).

### Tests

- `modules/blog/tests/adoption-gaps-379.test.ts` on the model text with replaced sentences:
  - a capture-group pattern reads the number after the keyword (the issue's case 1 passes; the same text with a
    wrong value fails with the captured number in the message);
  - without a capture group the first number is read as before;
  - a group 1 without a number leaves the sentence unchecked;
  - a sentence with two years passes on either year's value and the message lists both when it fails;
  - `onUnknownYear: "warn"` warns for an unknown year (case 2), `"skip"` and the default stay silent;
  - the schema refuses an `onUnknownYear` outside the two values.

### Implementation

- `facts.ts`: `FACT_UNKNOWN_YEAR = ["warn", "skip"]`, `onUnknownYear` in `factRuleSchema` (default `"skip"`),
  update the file comment.
- `rules/facts.ts`: `readSentence` returns all years (`years: number[]`); new `readFactValue(sentence, rule,
  notation)` reads group 1 or falls back; `checkFacts` checks all years and handles the unknown year.
- README "Fact rules", CHANGELOG `## Unreleased`.

## Progress

- [ ] Phase 1: tests and implementation
