# Plan review: list density (#1341)

Verdict: approve with one fix applied.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | Phase 2 sets theme-notion's kit range to `^0.1.10` before the kit version exists on master; `release:version` for the kit must run first or npm will not link the workspace. | Accepted: Phase 3 bumps the kit first; the range change rides Phase 3 after the kit bump. |
| 2 | Suggestion | Other themes (flat-atlas, flat-paint) get the variables through the kit but no components; say so in the kit README. | Accepted. |
| 3 | Suggestion | A test that the gallery renders the new components in both densities would guard the visual result. | Accepted if the gallery harness supports a wrapper; otherwise the unit test asserts the classes and the kit test the variables. |
