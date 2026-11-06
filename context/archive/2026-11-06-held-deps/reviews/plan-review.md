# Plan review: held-deps

Verdict: approved.

- Scope matches change.md: the three held upgrades and the fflate finding, nothing else.
- Risk: the border-box default changes every OG element; the portrait-fit oracle and the four pixel snapshots cover
  the templates. The OTel minor bump is covered by the observability tests and the standalone tracing test.
- The ESLint switch only changes how programs are built, not which rules run; the lint must still pass with zero
  warnings.
