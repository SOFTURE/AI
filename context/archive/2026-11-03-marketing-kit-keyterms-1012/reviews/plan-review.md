---
change_id: marketing-kit-keyterms-1012
verdict: approved
---

# Plan review: marketing-kit-keyterms-1012

- Covers the issue's five proposals: film and config field with Scribe's limits, the provider's `keyterms` fields,
  a cache key that changes only with key terms, a surcharge in the estimate and a count on the charge, the fake
  recording the input.
- Compatibility: no key terms means the same form fields, the same cache key and the same estimate; `FootageRates`
  stays assignable from the old `Record<PaidStepKind, number>`; `FootageCharge` gains an optional field, so
  metering's structural `FootageChargeLike` is unaffected.
- One normalizer shared by config and pipeline keeps the two in step; code-point sort keeps keys host-independent.
- Expected failures are values (`{ ok, errors }`), matching the module standard.
- Parallel #1014 overlaps only in README and CHANGELOG; resolved at merge time.
- Approved without changes.
