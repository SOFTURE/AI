# Plan: host-operator-keys

## Approach

1. `src/ssh/public-key.ts`: `parsePublicKey(text)` returns `{ type, body }` or a reason: exactly one line, a known
   type (ed25519, ecdsa nistp256/384/521, sk-ed25519, sk-ecdsa, rsa), a base64 body whose wire-format type string
   equals the declared type, no options prefix, not a private key. `server` reuses it for `adminPublicKey`.
2. `src/operator/` (pure): `OPERATOR_LABEL`, `formatOperatorComment(slug, label)`, `formatOperatorLine(...)`
   (`command="/srv/<slug>/deploy.sh",restrict <type> <body> <slug>-operator-<label>`), `listOperatorLines(text, slug)`
   and `describeOperatorCommands(app, inventory, keyPath)` (the ssh lines and `deploy.sh`'s subcommands, `run`/`report`
   only with `database`).
3. `ansible/operator.yml`: asserts the vars, ensures `.ssh`/`authorized_keys` exist with the right owner and mode,
   slurps the file, fails when the key body is on a line other than the owned comment, then `lineinfile` present or
   absent by `\s<comment>$`. `buildOperatorVars` in `src/ansible/vars.ts`; `PlaybookRun.playbook` gains `operator.yml`.
4. CLI `operator add-key`, `operator remove-key`, `operator list` (`src/cli/operator-command.ts`), wired in `run.ts`
   with usage. `add-key` prints the line (with `--check`: the line it would add) and the commands to run. `list` reads
   the file as the admin (`ssh … sudo -n cat /home/<deployUser>/.ssh/authorized_keys`) and prints label and
   fingerprint per line.
5. README "Running operator commands", deploy README step 3 points to it, CHANGELOG `## Unreleased`.
6. `e2e/converge.sh`: operator scenario against the container (add twice = one line, another app's and the release
   line unchanged, shell refused while the forced command runs, duplicate key refused, check mode changes nothing,
   remove-key removes only its line). `scripts/e2e-operator-vars.ts` builds the vars with the CLI's own code.

## Decisions (auto)

- `--name` defaults to `default`; label `[a-z0-9]{1,32}`, `release` refused (see research, Collisions).
- The key's own comment is replaced, as the role does for the release key.
- `list` uses the admin's SSH connection (read-only, `sudo -n`), not a playbook, so the CLI prints the lines itself.
- The conflict check runs on the server inside the playbook (with become), so it sees the file the write changes.
- `remove-key` of a label that has no line is a no-op reported as such, not a failure.

## Phases

1. Public key parsing and the operator line helpers with unit tests (fail before: modules missing).
2. Playbook, vars, CLI commands and their tests.
3. README, deploy README pointer, CHANGELOG, e2e scenario.

## Acceptance

- `npx vitest run tools/host` green with the new tests; typecheck and lint green.
- e2e (`tools/host/e2e/converge.sh`, CI job `host-ansible`): add-key twice leaves one line, other lines byte-equal,
  an interactive shell is refused while `status` runs `deploy.sh`, `--check` leaves the file unchanged, a key used by
  another line is refused, remove-key removes only its line.

## Progress

- [x] Phase 1 (742dd09): `parsePublicKey` (one line, known type, base64 blob that declares the same type, no options,
      no private key; `server` reuses it) and the operator line helpers; `src/operator/operator.test.ts` and the
      `parsePublicKey` cases in `ssh.test.ts` (modules missing before); `npx vitest run tools/host` green.
- [x] Phase 2 (3831508): `ansible/operator.yml`, `buildOperatorVars`, `captureAsAdmin`, CLI `operator add-key`,
      `remove-key`, `list`; `src/cli/operator-command.test.ts` (12 tests); `npx vitest run tools/host` 85 of 85.
- [x] Phase 3 (54c0a6e): README "Running operator commands", deploy README step 3 points to it, CHANGELOG
      `## Unreleased`; `e2e/converge.sh` operator scenario run locally against ubuntu:24.04 with sshd
      (`HOST_E2E_COLLECTIONS` = softure.vps_foundation 1.25.0 + the `ansible` package's collections, since Galaxy is
      not reachable from this container): `converge: PASS` (add-key twice = one line and `changed=0`, other lines
      byte-equal, `status`, a shell command and a login without a command all reach deploy.sh only, `--check` reports
      `changed=1` with the line and leaves the md5 unchanged, four taken keys refused, remove-key removes only its line
      and the removed key no longer logs in). `npx vitest run tools/host tests/repo` 1342 passed, 81 skipped; typecheck,
      lint and language gate green in every pre-commit.
