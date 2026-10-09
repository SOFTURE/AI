# Plan: deploy-integration-adoption-gaps

Input: change.md (research and framing skipped, reasons in change.md). Complexity: medium (three phases).

## Goal

`@softure-ai/deploy` 0.1.8 closes the four gaps of issue #308 without changing what a caller of 0.1.7 sees.

## Key decisions

- **D1 Flaky tests in the note.** `SuiteCounts` (the old `JunitCounts`, kept as an alias) gains `flaky: string[]`. The
  note gains an optional `flaky` array, written only when non-empty, so the 0.1.7 reader (strict schema) still reads
  every note without flaky tests. The contract prints one `flaky: <name>` per test after the `new-red` lines.
- **D2 JUnit flaky signal.** A JUnit case that passed with a `<flakyFailure>` or `<flakyError>` child (Surefire's
  rerun format) counts as passed and flaky; other JUnit writers carry no signal, as today.
- **D3 Playwright JSON.** `readPlaywrightJsonCounts(text)` narrows the report with zod (`suites` with nested `suites`
  and `specs`, each spec's `tests` with `projectName` and `status`): `skipped` is left out, `expected` passes,
  `flaky` passes and is flaky, `unexpected` is red. A name is `[project] › file › describe… › title`, the project only
  when set. A report that is not JSON or not that shape returns a problem, never throws.
- **D4 record flags.** `--results=<path>` with `--format=junit|playwright-json` (default by extension: `.json` is
  Playwright, anything else JUnit); `--junit=<path>` stays as `--results` with `--format=junit`, and both together are
  a usage error. A missing or unreadable report stores no counts and says why on stderr, as today.
  `--fail-on-flaky` stores red when the report names a flaky test and exits 1 after storing.
- **D5 Names.** `--notes-ref=refs/notes/<x>` on `run`, `lookup` and `record`; `--ref-prefix=<a/>` (ending in `/`) on
  `run` and `record` (the run name is the part after the prefix). The git-notes functions take the notes ref as an
  argument; the library options get optional `notesRef` and `refPrefix`.
- **D6 Workflow.** `deploy-integration.yml` adds `results-report` and `results-format` (`junit-report` stays as the
  JUnit form; both set is refused), `image` (`<name>@sha256:<64 hex>`; then a tag push is accepted too), `fail-on-flaky`
  (passed to the suite as `INTEGRATION_FAIL_ON_FLAKY=true` and to `record` as `--fail-on-flaky`), `expected-origins`
  (http(s) origins, as `INTEGRATION_EXPECTED_ORIGINS`), `notes-ref` and `ref-prefix`. With `image` the test job pulls
  it before the app's code runs (logged in with the optional `registry-token` secret through a throwaway Docker
  config), and the suite sees `INTEGRATION_IMAGE`. The ref deletion uses `ref-prefix`. The record step passes the new
  flags only when they differ from the defaults, so a caller pinning an older CLI keeps working.
- **D7 Version 0.1.8.** `package.json`, the lockfile, `deploy-cli-version` of the three reusable deploy workflows,
  CHANGELOG `## 0.1.8`, README.

## Phase 1: CLI and library (tests first)

- [x] Failing tests: contract `flaky:` lines, JUnit flaky, Playwright JSON reader, note `flaky` round trip, CLI
  `--results`/`--format`/`--fail-on-flaky`, `--notes-ref` and `--ref-prefix` against the bare-repository fixture.
- [x] Implement D1-D5; usage text in `run.ts`; exports in `src/integration/index.ts`.

## Phase 2: workflow

- [x] Failing repository tests for D6 (validation, pull step, record arguments, ref deletion with a prefix).
- [x] Implement D6; `examples/integration.yml` comment names the new inputs.

## Phase 3: release notes

- [x] D7; README "Integration run" and "Integration workflow"; gates.

## Progress

- 2026-10-09: plan written.
- 2026-10-09: phase 1 done (unit and CLI tests failed first, then pass).
- 2026-10-09: phase 2 done; the pull step takes a `registry-token` secret instead of `packages: read` (change.md,
  Decisions).
- 2026-10-09: phase 3 done; gates green.
