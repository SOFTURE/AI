# Implementation review: modules-workers-sweep

- **Drift from plan:** foundation entries (ui, theme-kit, auth `./next`/`./ui`, core `./og`) were declared too; the
  module entries import them, so the guard required it. Recorded under Decisions (auto).
- **Correctness:** every switched import uses only symbols `@softure-ai/db/request` exports (`getConfiguredDatabase`,
  `findDriverError`, `isConstraintViolation`, `Queryable`); typecheck confirms. CLIs and scripts keep the root entry.
- **Behaviour on Node:** unchanged except pwa preferring `SOFTURE_BUILD_VERSION` when set (documented, tested).
- **Tests:** the guard covers each declared entry (82 tests); files and pwa Workers paths were seen failing before the
  fix. Lockfile edited for versions and ranges only, so no npm-version churn.
- **Open:** alerts and blog get `runtimes: workers` and their `./server` entries in RP-4.
- Verdict: approve.
