# Implementation review: deploy-integration-adoption-gaps

Reviewed: the branch diff against plan.md, change.md and issue #308.

- D1: `flaky` is optional in the note schema and left out by `formatIntegrationNote` when empty (test: a note without
  flaky tests has no key); the contract prints `flaky:` lines after `new-red`.
- D2: `readJunitCounts` counts `<flakyFailure>` / `<flakyError>` cases as passed and flaky.
- D3: `readPlaywrightJsonCounts` narrows the report with zod, walks nested suites, skips `skipped`, names tests
  `[project] › file › describe › title`; not JSON or a wrong shape is a problem value.
- D4: `--results`/`--format`/`--junit` and `--fail-on-flaky` (stores red, exits 1 after the push); usage errors for
  both report flags, an unknown format, `--format` alone.
- D5: the notes ref is an argument of every git-notes function; `--notes-ref` and `--ref-prefix` are validated before
  any git call (bare-repository tests for record, lookup and run).
- D6: the workflow validates every new input, pulls the image through a Docker config deleted on exit (test with a
  fake `docker`), hands the three variables to set-up and suite, deletes `<ref-prefix><name>` only, and accepts a tag
  only with `image`. No input or secret is interpolated into a script (guard test).
- D7: 0.1.8 in `package.json`, the lockfile, the three workflow defaults, the README's `ls-remote` example; CHANGELOG
  `## 0.1.8`.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Minor | `packages: read` on the test job (the plan's first form) would fail every caller that does not grant it. | Fixed before review: optional `registry-token` secret (change.md, Decisions). |
| F2 | Suggestion | An app's existing notes in its own format are not migrated. | Documented in the README ("An app with its own names"); out of scope by the decision in change.md. |
