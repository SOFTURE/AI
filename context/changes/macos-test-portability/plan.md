---
change_id: macos-test-portability
status: implementing
updated: 2026-10-07
---

# Plan: macos-test-portability

Input: change.md (research skipped, see its Context)

## Goal

The tests that run the repository's shell scripts pass with macOS's system bash 3.2 and BSD tools, and a macOS CI
job keeps them passing.

## Approach

Make the scripts portable rather than skip the tests on a Mac: the code paths stay tested on both systems and the
runner's behaviour does not change. Rejected: skipping with a named reason when bash < 4 or GNU tools are missing
(the owner's Mac would stop testing the scripts it ships); requiring Homebrew bash and coreutils in `AGENTS.md`
(a setup step every contributor and agent session must repeat, and still no guard).

## Key decisions

- **D1. Duplicate build-arg names via a newline-delimited string,** not an associative array: `[[ "$seen" ==
  *$'\n'"$name"$'\n'* ]]` works in bash 3.2 and names are `[A-Za-z_][A-Za-z0-9_]*`, so no name holds a newline.
- **D2. Lower case through `tr '[:upper:]' '[:lower:]'`** instead of `${REPOSITORY,,}`; GitHub repository names are
  ASCII.
- **D3. Tar owner flags by flavour:** GNU tar keeps `--owner=0 --group=0`, any other tar (bsdtar) gets `--uid 0 --gid
  0`; both with `--numeric-owner`. An array keeps the flags quoted, and is never empty (bash 3.2 with `set -u`).
- **D4. `check-received.sh` sorts the received list before `comm`** and drops `--nocheck-order`: both inputs are then
  sorted under `LC_ALL=C`, which is what `comm` needs on GNU and BSD alike.
- **D5. The listing test accepts both formats:** GNU `-rw------- 0/0 …` and bsdtar `-rw-------  0 0  0 …`.
- **D6. The macOS CI job runs `tools/deploy/tests` and `tests/repo/deploy-workflows.test.ts`** on `macos-latest` with
  `/usr/bin:/bin` first in `PATH`, because the runner image puts Homebrew's bash 5 ahead of the system one. Not the
  whole suite: the database tests need the Postgres service CI has only on Linux, and the rest does not run shell
  scripts. It prints the bash and tar versions it used.

## Phase 1: portable scripts and a macOS CI job

**Discipline:** test-after (the existing tests already fail under the emulation; the new CI job is the guard).
**Files:** `.github/workflows/deploy-app.yml`, `tools/deploy/e2e/check-received.sh`,
`tools/deploy/tests/server-files.test.ts`, `.github/workflows/ci.yml`, `AGENTS.md`.

Steps: D1 to D5; the `macos` job in `ci.yml` (D6) with `timeout-minutes`; one bullet under "Gates and hooks" in
`AGENTS.md`.

Done when: the deploy tests and the deploy workflow repository tests pass with the emulation of change.md first in
`PATH` and without it; the gates are green; actionlint and shellcheck accept the workflows (CI's `workflows` job);
the macOS job is green.

## Risks and rollback

- The macOS job may turn up failures the emulation missed (the issue's three unexplained server-files tests). They
  are this change's to fix when they come from the scripts; the job stays required.
- Rollback: revert the commit; the scripts return to their GNU-only form.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: portable scripts and a macOS CI job

#### Automated
- [x] 1.1 Deploy tests and deploy workflow repository tests pass with bash 3.2, bsdtar and BSD-style comm first in PATH — bdc7357
- [x] 1.2 The same tests pass with the runner's bash 5 and GNU tools — bdc7357
- [x] 1.3 Gates green (typecheck, lint, test) — bdc7357
- [ ] 1.4 CI green, the macOS job included

#### Manual
- [ ] 1.5 `npm test` passes on the owner's Mac with the system shell (the mailing and ops failures of the issue were not reproduced elsewhere)
