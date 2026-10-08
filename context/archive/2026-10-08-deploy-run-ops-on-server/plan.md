# Plan: deploy-run-ops-on-server

Input: change.md (research and framing skipped, reasons there). Complexity: medium (three phases).

## Today (master `cefd4a7`)

- `init`'s `deploy.sh` is the forced command of the deploy key (`command="/srv/<app>/deploy.sh",restrict`). It reads
  `SSH_ORIGINAL_COMMAND` as one line split on blanks without expansion and accepts `deploy <tag>`, `status`,
  `maintain`; anything else is exit 2 with `result|failed|command|…`.
- The app container gets `DATABASE_URL` of `softure_app` (SELECT/INSERT/UPDATE/DELETE, no DDL); the postgres
  container accepts local socket connections without a password (the image's default `trust` for `local`).
- `Dockerfile.tmpl` (database apps) bundles `scripts/migrate.ts` into `migrate.mjs` with esbuild, `pg` and the
  drizzle adapters external; nothing bundles ops scripts.
- `runOpsScript` parses `--key=value`, `--commit`, `--help`, reads `--<key>-file=-` from stdin, and returns exit
  0 / 1 / 2. Nothing runs it on a server.
- The CLI's commands return nothing; `runCli` maps a `CliFailure` to its exit code. No command spawns a long-running
  child with streamed output or forwards stdin.

## Goal

`@softure-ai/deploy` with `run` and `report` (client and gateway), a Dockerfile that bundles `scripts/ops/*.ts`, and
the docs to adopt both in an app generated before them.

**Out of scope:** shipping script code over SSH; a report format of our own (psql's aligned table is the report);
a read-only database role (see decision "report is read only"); `run`/`report` for an app without a database.

## Key decisions

- **Scripts run from the image, not shipped (deviation from the issue's wording).** Every `scripts/ops/<name>.ts`
  (not `*.test.ts`) is bundled into `/app/ops/<name>.mjs` in the build stage, like `migrate.mjs`. `run <name>` on the
  server is `docker compose exec -T app node ops/<name>.mjs <args>`. A key bound to `deploy.sh` can then run only
  what a release built, and the definition stays the app's single source.
- **Gateway grammar:** `run <script> [arg …]` and `report [arg …]`. `<script>` is kebab-case (the ops script name
  pattern); each argument is `--<key>` or `--<key>=<value>`, key kebab-case. Values cannot hold blanks (the command
  line is split on blanks); the client refuses such a value before connecting and points at `--<key>-file`.
- **stdin:** for `run` it is forwarded to the script, so `--<key>-file=-` reads it. The client turns one
  `--<key>-file=<local path>` into `--<key>-file=-` with the file's content on stdin (the path means the operator's
  machine; the container has no such file). Two such arguments are a usage error. For `report`, stdin is the SQL
  file, capped at 1 MiB on the server.
- **report is read only (a guard against mistakes, not a sandbox):** `psql -X -v ON_ERROR_STOP=1 --single-transaction`
  as `softure_app` with `PGOPTIONS=-c default_transaction_read_only=on`; an `INSERT`/`UPDATE`/DDL fails and nothing
  is written. A file that turns the setting off itself is not stopped; the key holder can deploy any image anyway.
  Documented as such. `--key=value` becomes `-v key=value` with `-` in the key mapped to `_` (psql variable names),
  used as `:'key'` (quoted literal) in the file. A bare `--flag` and `--commit` are refused for a report.
- **Locks and result lines:** `run` takes the deploy lock (no script during a switch); `report` takes none, like
  `status`. Neither prints `step|`/`result|` lines: the output is for people; the exit status is the script's
  (0 done, 1 refused or failed, 2 usage), or 1/2 from the gateway's own refusals.
- **Gateway checks for run:** `.env.prod` present, the app container running, `ops/<name>.mjs` in it (else the
  message lists the scripts the live image has).
- **Client:** `softure-deploy run|report --host=<ssh-host> [--port=<n>] [--ssh=ssh] <script|file> [args]`. Client
  flags come before the script or file; everything after it is the script's. ssh runs as
  `ssh -T [-p port] -- <host> <command>` with an argument list, never a shell. The host must not start with `-`. ssh's
  own failure (255) is exit 1 with a line naming the host; any other status passes through. Output is streamed.
- **No database:** the `deploy.sh` of an app without a database does not accept `run`/`report` (no `{{#database}}`).

## Phases

### Phase 1: gateway and image (TDD)

- `templates/docker/server/deploy.sh.tmpl`: header, command parsing, `run` and `report` blocks (database only).
- `templates/Dockerfile.tmpl`: bundle `scripts/ops/*.ts` into `ops/`, copy `ops/` into the runner.
- Tests in `tests/server-files.test.ts` (stub docker answers `exec`): run passes the words and stdin to
  `compose exec -T app node ops/<name>.mjs`, with the script's exit status; refuses a bad name or argument (exit 2,
  nothing executed); refuses before a deploy, with no app container, with an unknown script (lists the image's
  scripts); takes the lock. report sends the file to psql in the postgres container read only with `-v` variables;
  refuses an empty or oversized file, a bare flag, `--commit`; is not accepted without a database.
  `src/init/generate.test.ts`: the Dockerfile bundles and copies `ops/` with a database only.
- Done when: deploy tests green.

### Phase 2: client commands (TDD)

- `src/cli/remote-command.ts` (`runRemoteScript`, `runRemoteReport`), `CliIo.stdin?`, commands may return an exit
  code; `run.ts` USAGE and table; `main.ts` leaves `stdin` unset, so ssh inherits the terminal (impl review 4).
- Tests `tests/remote-cli.test.ts` with a stub `ssh` (records argv and stdin): the remote command line; client flags
  only before the script; `--x-file=<path>` sent on stdin; stdin forwarded; the file for a report; exit status passed
  through, 255 as 1 with the host; usage errors (no host, host starting with `-`, a value with a blank, two file
  arguments, missing script or file, unreadable file).
- Done when: deploy tests green.

### Phase 3: docs and gates

- README section "Ops scripts and reports on the server" (setup: the operator's key line, the runner file, the
  Dockerfile lines for an app generated before; usage; safety), exit codes, USAGE; CHANGELOG `## Unreleased`;
  `package.json` description; a pointer from `modules/ops/README.md` "scripts" to it.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

- [x] Phase 1: gateway and image
- [x] Phase 2: client commands
- [x] Phase 3: docs and gates
