---
change_id: deploy-ops-local-run
---

# Research: deploy-ops-local-run

Sources: `tools/deploy/src/cli/{remote-command,run,io,failure}.ts`, `tests/remote-cli.test.ts`,
`templates/docker/server/deploy.sh.tmpl` (`run`), `templates/Dockerfile.tmpl` (ops bundle), `README.md` ("Ops scripts
and reports on the server"), `modules/ops/src/scripts/ops-script.ts`, `modules/ops/README.md` ("Safe ops scripts").

- `runRemoteScript` parses client flags (`--host`, `--port`, `--ssh`) before the script name, checks the name
  (kebab-case) and each word (`--key[=value]`, no blank since the server splits on blanks), turns one
  `--<key>-file=<path>` into stdin, and spawns ssh with an argument list. `parseCommandLine` requires `--host`.
- On the server `deploy.sh run` executes `node ops/<name>.mjs <words>` in the app container; the image bundles every
  `scripts/ops/<name>.ts` (not `*.test.ts`) into `ops/<name>.mjs`. So the app's source of truth is
  `scripts/ops/<name>.ts`, a runner that calls `runOpsScript({ script, argv: process.argv.slice(2), config })`.
- The ops helper owns the dry run (rollback unless `--commit`), the zod validation of arguments, `--help` and
  `--<key>-file`; its config opens `database.url`, which apps take from `DATABASE_URL`. A local run therefore needs
  only the runner executed with the same argv and `DATABASE_URL` in its environment.
- Apps run TypeScript scripts with `tsx` (the ops README mentions apps whose scripts run under `tsx`); Node's own type
  stripping does not resolve extensionless relative imports such as `../../softure.config`, so `tsx` it is.
- The tests' stub ssh in `tests/remote-cli.test.ts` is the same idea as the issue's fake: a bash script writing argv
  and stdin to files named in the environment. Other packages ship test helpers as a `./testing` export
  (`foundation/db`, `modules/auth`, …): `src/testing.ts`, built to `dist/testing.js`; `tests/repo/packages.test.ts`
  checks each export lists source, types and default in that order.
- `CliIo.stdin` unset means the child inherits stdin; `env` is passed whole to the child.
