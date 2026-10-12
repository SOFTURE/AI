---
change_id: deploy-ops-local-run
status: implementing
---

# Plan: deploy ops local run and fake ssh (issue #405)

Input: change.md, research.md. Complexity: medium (one new export, one new CLI mode, tests, docs).

## Phase 1: `@softure-ai/deploy/testing` `installFakeSsh` (TDD)

Files: `tools/deploy/src/testing/{index,fake-ssh}.ts`, `src/testing/fake-ssh.test.ts`, `package.json` exports.

1. Tests first: a spawned `ssh` (found on `PATH`) is the fake; `calls` lists each call's `args` and `stdin` in order;
   the reply's stdout, stderr and status come back; a list of replies is used one per call, the last repeating;
   arguments with blanks and newlines survive; `restore()` puts `PATH` back and removes the folder; `runCli run`
   with `--ssh=<fake.path>` round-trips.
2. Implement: a temporary folder with `bin/ssh` (bash 3.2), reply files per index, calls as NUL-separated argv plus
   stdin files; `calls` is a getter reading them synchronously.

## Phase 2: `run --local` (TDD)

Files: `tools/deploy/src/cli/{remote-command,local-command,run}.ts`, `tests/local-run-cli.test.ts`.

1. Tests first (a stub `tsx` on `PATH` recording argv, cwd, `DATABASE_URL` and stdin): runs
   `scripts/ops/<name>.ts` with the words after the name; passes `--commit`, `--help`, a blank value and a
   `--<key>-file` as is; ends with the script's status; `--url-env=NAME` sets `DATABASE_URL` for the child; names
   the host and database on stderr without credentials; `--scripts-dir` and `--tsx` override. Refusals (exit 2,
   nothing run): `--local` with `--host`, `--port` or `--ssh`; missing or bad name; bad word. Exit 1: no
   `DATABASE_URL` (or empty `--url-env`), a script file that does not exist (with the list of the folder's scripts),
   a runner that cannot start.
2. Implement in `local-command.ts`; `runRemoteScript` hands over to it when the first client flag set contains
   `--local`. Add `run` and `report` to `USAGE`.

## Phase 3: docs

`tools/deploy/README.md` (local run in the ops section, a "Testing" section for `installFakeSsh`, the library list),
`tools/deploy/CHANGELOG.md` (`## Unreleased`), `modules/ops/README.md` pointer.

## Progress

- [ ] Phase 1: `installFakeSsh`
- [ ] Phase 2: `run --local`
- [ ] Phase 3: docs
