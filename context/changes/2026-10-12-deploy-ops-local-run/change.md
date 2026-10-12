---
change_id: deploy-ops-local-run
title: "deploy: a fake ssh for tests and run --local against DATABASE_URL (issue #405)"
status: implementing
roadmap_item: null
issue: 405
branch: claude/project-thread-ud7iop
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #405](https://github.com/SOFTURE/AI/issues/405) (labels `enhancement`, `pkg: deploy`, `adoption`).
Operator scripts go through `softure-deploy run` (the forced-command gateway), yet every app still writes two things
around it:

1. a fake `ssh` on `PATH` that captures argv and stdin and answers with a scripted reply, to test its operator
   wrappers without a server;
2. wrappers that re-validate the arguments and switch between "production over ssh" and "local database" by hand.

Outcome:

- `@softure-ai/deploy/testing` exports `installFakeSsh({ reply }) → { calls, restore, … }`: a fake `ssh` first on
  `PATH` that records each call's arguments and stdin and answers with the scripted stdout, stderr and exit status.
- `softure-deploy run --local <script> [args]` runs the same ops script (`scripts/ops/<name>.ts`, the file the image
  bundles) on this machine against `DATABASE_URL`; the script itself keeps the dry run unless `--commit`, so app
  wrappers shrink to npm aliases.

A reviewer checks `tools/deploy/src/testing/fake-ssh.test.ts`, `tests/local-run-cli.test.ts`, the README sections
"Ops scripts and reports on the server" and "Testing", and the CHANGELOG `Unreleased` entry.

## Context

deploy is at 0.1.9 on master. Releases are batched by the coordinator, so no version bump: CHANGELOG `## Unreleased`.
Issue #406 (deploy workflows) waits on this change.

## Constraints

- The remote path (`run --host=…`) is unchanged byte for byte: same ssh argv, same refusals.
- The fake ssh is a bash script within bash 3.2 and BSD/GNU-common flags (AGENTS.md: tests run on macOS).
- No new runtime dependency.

## Process notes

- Framing: skipped. The issue names both gaps and a proposal for each.

## Decisions (auto)

- `run --local` runs `scripts/ops/<name>.ts` with `tsx` (from `PATH`, so an npm script's `node_modules/.bin`;
  `--tsx=<program>` overrides): the source the image bundles, so no build step and the same argv parsing, dry run
  and `--commit` as in production. The script reads the database from the app config, so the CLI checks that
  `DATABASE_URL` is set (or copies `--url-env=<NAME>` into it) and names the target host and database on stderr
  before running, so nobody hits the wrong database unknowingly. Credentials are never printed.
- Local arguments are an argument list, not a command line: a value with a blank is allowed locally (nothing splits
  it), and `--<key>-file=<path>` is passed as is (the script reads the file itself). The name and `--key[=value]`
  shape checks stay, so a wrapper needs none of its own.
- `--local` and `--host` exclude each other; `--port` and `--ssh` belong to the remote path only.
- `installFakeSsh` takes one reply or a list (one per call, the last repeats), records calls in a temporary folder
  and reads them back synchronously through `calls`; `restore()` puts `PATH` back and deletes the folder. It also
  returns the fake's path, for `--ssh=<program>`, and the folder for an env the test builds itself.
