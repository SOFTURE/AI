---
change_id: macos-test-portability
title: "npm test runs green on macOS with the system shell and tools, and CI keeps it so"
status: archived
roadmap_item: null
issue: "#177"
branch: claude/project-thread-pj5mlg
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close [issue #177](https://github.com/SOFTURE/AI/issues/177). On macOS, `npm test` on a clean `master` is red, so
`pre-push` refuses every push from a Mac and `AGENTS.md` forbids `--no-verify`. The tests run the deploy workflow's
`run:` steps and the deploy e2e scripts as they are, and those use tools macOS does not ship.

After this change:

- The scripts the tests run work with macOS's `/bin/bash` 3.2 and its BSD tools as well as with bash 5 and GNU tools
  on the runner: no associative arrays, no `${var,,}`, no `comm --nocheck-order`, tar owner flags per tar flavour.
- The test that reads a `tar -tv` listing accepts both the GNU and the bsdtar listing format.
- A CI job on a macOS runner runs the tests that execute the repository's shell scripts, so a GNU or bash 4 feature
  that slips back in turns CI red instead of a developer's Mac.
- `AGENTS.md` says the scripts the tests run stay portable to macOS's bash 3.2 and BSD tools.

Done when: the deploy tests and the deploy workflow repository tests pass on Linux with bash 3.2, bsdtar and a
`comm` without long options first in `PATH` (an emulation of macOS, see Context), pass on the macOS CI job, and the
gates are green.

## Context

Reproduced on Linux by putting macOS's tools first in `PATH`: bash 3.2.48 (Ubuntu's old `bash_3.2` package; macOS
ships 3.2.57), `bsdtar` 3.7.2 as `tar` (libarchive, macOS's tar) and a `comm` wrapper that rejects long options as
BSD `comm` does. Results on `master` (`npx vitest run tools/deploy/tests tests/repo/deploy-workflows.test.ts`):

| tools first in `PATH` | failing tests | cause |
| --- | --- | --- |
| bash 3.2 only | 9 (release-guards, deploy-workflows) | `declare -A` and `${REPOSITORY,,}` in the check job: exit 2 |
| bsdtar only | 27 (server-files) | the pack step's `tar --owner=0 --group=0`: `Option --owner=0 is not supported` |
| all three, pack fixed | 13 | the two above, `comm --nocheck-order` in `check-received.sh` (3), the `tar -tv` listing regex of the registry-token test (1) |

macOS 27's tar may accept `--owner` (the issue saw pack pass); bsdtar 3.7.2 does not, so the step picks the flags by
tar flavour. Not reproduced here, with the emulation or on Linux: the issue's schema-guard restore, cron step report
and ssh failure tests of `server-files.test.ts`, `modules/mailing/tests/suppressions.test.ts` (8 runs with random
seeds green) and the `beforeAll` timeout of `modules/ops/tests/health.test.ts` (the hook timeout is already 60 s in
`vitest.config.mts`). The macOS CI job answers the first three on a real Mac.

Research and framing are skipped: the issue names the causes and the options, and the measurements above decide
between them. Portable scripts beat skipping with a reason: CI runs the same tests on Linux either way, and a skip
would leave the Mac with an untested path the owner runs every push.

## Constraints

- Neutral wording in the repository and on GitHub.
- Behaviour on the runner and on the server stays the same: the pack step still writes owner 0/0 with numeric ids,
  the check job refuses the same inputs with the same messages.
- No release in this change.
- Other issues run in parallel; this change touches `deploy-app.yml` (check and pack steps), the e2e
  `check-received.sh`, `server-files.test.ts`, `ci.yml` and `AGENTS.md`, and merges master on conflict.

## Notes

- Owner check (Manual 1.5): run `npm test` on the Mac with the system shell. The `macos` CI job proves the shell
  script tests there; the issue's mailing `suppressions` and ops `health` failures did not reproduce elsewhere.
