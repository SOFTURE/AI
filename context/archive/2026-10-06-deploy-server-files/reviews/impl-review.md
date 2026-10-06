# Implementation review: deploy-server-files

Scope: full · Date: 2026-10-06 · Gates: typecheck, lint (ESLint + language), test, build, actionlint 1.7.12 with
shellcheck over every workflow and the example caller, shellcheck over the rendered `deploy.sh` (with and without a
database)

## Verdict

Ready. The deploy job packs the compose file's folder, `server-script` (as `deploy.sh`), `deploy-config` (as
`deploy.json`) and `.env.prod` into `release.tar.gz` and sends it in the one SSH call; `init`'s `deploy.sh` checks it,
unpacks it into `releases/<tag>/`, checks the compose file, installs the files next to itself and runs the release.
`tools/deploy/tests/server-files.test.ts` (14 tests) runs the workflow's pack step and the generated `deploy.sh`
together with a stub `docker`; `tests/repo/deploy-workflows.test.ts` gained 4 tests. By hand: the `check` script emits
the anchored patterns and refuses a compose file at the root and a `server-script` with `..`; a non-cone sparse
checkout of those patterns fetches the compose folder, the script and the root `deploy.json` only (not
`pkg/deploy.json`, `.npmrc` or `package.json`); bash finishes a running script that `mv` replaced from its old copy.

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan coverage | PASS | new input, check outputs, checkout, pack, send, cleanup; template; README; 0.1.1; W2 and S1 of the plan review taken |
| Tests | PASS | installed files equal to the tag's with their modes, `.env.prod` 0600 and not left in the release folder, docker calls in order; rules' inode kept and Traefik restarted only when they changed (not on the first release); `deploy.sh` replaced by a rename; 5 release folders kept; no `deploy.json` with an empty `deploy-config`; refusals (empty stdin, not an archive, symlink, `..` member, no `.env.prod`, invalid compose file) with nothing installed; pack refusals (symlink, reserved name, missing file) |
| Security | PASS | the archive is listed before extraction (files and folders only, narrow names, no `..`), capped at 16 MiB, unpacked without owners; the pack step refuses symlinks; values reach scripts through `env:` only; the checkout stays anchored and credential-free; shipping `deploy.sh` widens nothing (README) |
| Correctness | PASS | in-place `cp` for bind-mounted files, rename for the running script; a refused archive removes its release folder; the first release installs before any compose call |
| Conventions | PASS | the workflow's check/env/sparse patterns; shellcheck clean (one documented `ls` over tag-named folders); English only |

## Findings

- **W1 (warning, accepted):** the workflow still cannot run before DP-8 publishes `@softure-ai/deploy` and sets the
  tag; DF-3 runs it end to end against a throwaway SSH server.
- **W2 (warning, accepted):** a path that is a folder on the server and a file in the release (or the reverse) is not
  replaced cleanly; `cp` fails or nests the file. Not a layout `init` produces; the release stops at that file.
- **S1 (suggestion, kept):** the database steps of `deploy.sh` (backup, schema guard, row counts) are not exercised by
  the new test, which runs the variant without a database; their lines did not change apart from the messages, and
  DF-3 runs the whole script.
