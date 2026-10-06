# Implementation review: deploy-init-release-caller

Reviewed: commit `0a0da49` against plan.md, the plan review and the project rules. Verdict: **approve**; no
blocking finding, no new gap.

## Checks run

- Tests red before the template existed (`.github/workflows/release.yml was not planned`; the CLI output lacked
  the file and the kept count), green after: `src/init/generate.test.ts`, `tests/init-cli.test.ts`,
  `tests/cli.test.ts` and `tests/repo/deploy-workflows.test.ts`, 127 tests.
- `npm run typecheck`, `npm run lint`, `npm run build`: green; `npm test` runs in `pre-push`.
- The built CLI's `init` on a bare app writes 8 files with `release.yml`; actionlint 1.7.12 (checked against its
  SHA-256) with shellcheck over the generated `release.yml` and `deploy.yml`: clean.
- `npm run e2e-app -w @softure-ai/deploy`: `e2e/app/` unchanged (the caller is not shipped to the server).
- `npm pack --dry-run` lists `templates/.github/workflows/release.yml.tmpl`.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Check | Plan drift: none. Template, list entry right after the deploy caller, help line, README row and the "Cut a release" sentence, as planned. | No change. |
| 2 | Check | Drift between the example and the template is caught: the test compares the parsed YAML, so a changed input, permission or `uses:` in either fails; header comments may differ (they say who wrote the file). | No change. |
| 3 | Check | Keep rule: an existing `release.yml` stays byte for byte and is reported `kept`; `--force` rewrites it (CLI test). An app with its own release workflow under that name keeps it. | No change. |
| 4 | Check | Security: the template has no rendered values outside its header comment (`{{name}}`, `{{cliVersion}}`, both pattern-checked), so no answer reaches YAML structure. | No change. |
| 5 | Suggestion | `timezone: UTC` names the tag by the UTC date; a Polish app releasing after midnight local time gets the previous day's date. The header comment names `Europe/Warsaw`. | Stays as decided in change.md (the app owns the file; one word to change). |

## Not verified here

The first real run of a generated caller in an app is the owner's, after `@softure-ai/deploy` 0.1.3 is released and
`deploy-workflows-v1` points at a commit with `deploy-cut-release.yml` (DF-12's manual line).
