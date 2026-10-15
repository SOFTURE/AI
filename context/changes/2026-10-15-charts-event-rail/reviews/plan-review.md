# Plan review: charts-event-rail

Reviewed: plan.md @ 2026-10-15. Mode: quick. Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 0 suggestion.

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: the four asks of #508 map to D1–D4 (readout via the existing `renderReadout`) |
| Backwards compatibility | PASS: `layout` defaults to lanes; #409 oracles pinned |
| Data and migrations | N/A |
| Accessibility | WARN (W1) |
| Styling and tokens | WARN (W2) |
| Testability | PASS |

## Findings

### W1 [WARNING] Segment labels and ticks are hidden from assistive technology
**Effort:** low. **Lens:** Accessibility. **Where:** D4.
**Problem:** the whole track is `aria-hidden`, so the duration and the year are visual only.
**Fix:** the readout is the accessible channel, as for the lanes layout; the README tells the app to put the date and
the duration in `detail` or `renderReadout`.
**Decision:** Accept risk - copy belongs to the app; README states it.

### W2 [WARNING] An unlisted custom property fails the token check
**Effort:** low. **Lens:** Styling and tokens. **Where:** D6.
**Problem:** `--sft-chart-event-rail-width` is read by the stylesheet and is not a token.
**Fix:** add it to `LOCAL_PROPERTIES` in `tests/architecture.test.ts` with a fallback in every `var()`.
**Decision:** Fix now (applied) - Phase 1 lists the architecture test.

## Decisions (auto)

- W1 accepted, W2 fixed in the plan (above).
