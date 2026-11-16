# Plan review: marketing-kit-overlay-polish

- Contract: `measureCentred` keeps the old result when the centred one fails, so no stored cut is newly refused. OK.
- Risk: titles wider than the centred span are drawn a step smaller (a 64 px hook title at 58 px on `reels`). Accepted:
  the owner asked for the cards on the axis; the step is the title's own shrink.
- Risk: the chip badge widens each chip, so a row may shrink a step. Accepted, recorded in the CHANGELOG.
- Draft and render parity: both read `getChipParts` and `getChipCoveredTimes`. OK.
- Verdict: approve.
