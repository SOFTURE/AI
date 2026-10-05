# Implementation review: deploy-cli-env-notes

Scope: full · Date: 2026-10-05 · Gates: typecheck, lint (ESLint + language), test, build

## Verdict

Ready. Both commands of DP-1 are in `@softure-ai/deploy` with 36 package tests; the built bin was run by hand on a
compose file and on this repository's own history (`c8ff7bf...cbf66f0` gave #106 and #105 with links).

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan coverage | PASS | phases 1–3; the CLI entry has a command table DP-2…DP-5 extend |
| Tests | PASS | units for names, quoting, log parsing, entries, formatting; a temp git repository with tags and a `--no-ff` merge; the CLI in process |
| Security | PASS | a sentinel secret is absent from stdout and stderr on success and on both failures; `.env.prod` 0600 through a fresh temporary file (`wx`); refs checked against option and range forms before `execFile` |
| Correctness | PASS | `:?` refuses empty, `?` accepts it, `$$` skipped; first-parent log keeps branch commits out of the report |
| Conventions | PASS | result values for expected failures, `CliFailure` with exit codes 1 and 2, copy in `pl`/`en` with the same keys, English everywhere else |

## Findings

- **W1 (warning, deferred):** parity with FIRE_TRACKER's scripts, tests and report format is unchecked: the
  session could not read FIRE_TRACKER. Recorded as **DF-1** (`deploy-fire-parity`) in the new queued catch-all
  `deploy-followups`.
- **S1 (suggestion, fixed):** an existing temporary file would have kept a wider mode while the secrets were
  written; it is now removed and created with `wx`, with a test that an old 0644 `.env.prod` ends 0600.
- **S2 (suggestion, kept):** counts read "1 pull requests"; neutral plural forms would need ICU plural rules per
  locale, not worth it for a release body.
- **W2 (warning, fixed):** a new public package joins `auto-release all` at once (`release-tags.test.ts` caught the
  count going from 16 to 17), so a release run before DP-8 would try a first publish without its trusted publisher.
  `tools/deploy/package.json` is `"private": true` until DP-8, which now says it removes the flag.
