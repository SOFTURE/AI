# Plan: host-deploy-user-preflight

## Approach

1. Schema: `superRefine` adds an issue at `server.deployUser` when it equals `server.adminUser`; `parseInventory`
   already turns issues into a CLI failure (exit 2) before any command runs.
2. `ansible/tasks/deploy-user-preflight.yml`, imported first by `app.yml` (pre_tasks) and by a new first play of
   `server.yml`: one read-only probe (`check_mode: false`), a `fail` naming each conflict (sudo/wheel/admin group,
   sudoers entry for the user or one of its groups) with "Nothing was changed on the server", a fact
   `host_deploy_user_ready`, and in check mode a `changed` debug task that reports the user, its key file and the key
   line as a planned change. All tagged `always`.
3. `app.yml`: the `deploy_user` role gets `when: not ansible_check_mode or host_deploy_user_ready | bool`.
4. `e2e/converge.sh`: a check-mode first onboarding (passes, reports, creates nothing) before the first real run; at
   the end a sudo deploy user (password set) refused in check mode and in a real run with the shadow entry, groups,
   `authorized_keys` and `deploy.sh` unchanged and the password still usable.
5. README (inventory table and a paragraph) and CHANGELOG `## Unreleased`.

## Decisions (auto)

- Guard in this package, not in the collection → the collection is another repository; our pre-task runs before
  its role in every `softure-host` run, which is the failure the issue reports.
- Probe with `getent`/`id`/`grep`, not `sudo -l -U` → works where `sudo` is not installed (the e2e image).
- Skip the whole role in check mode when the key file is missing → role tasks cannot be skipped one by one, and the
  rest of the role only creates what the report names.
- No CLI-side SSH probe → the playbook runs in check mode too, so `--check` and the real run refuse with one message.

## Phases

1. Schema refine with tests (fail before: 2 tests).
2. Preflight task file, `app.yml` and `server.yml`; local verification with a local connection.
3. `e2e/converge.sh`, README, CHANGELOG.

## Acceptance

- `npx vitest run tools/host` green including the two new tests, which fail without the refine.
- Local runs of `app.yml` (local connection): check mode with no user passes and creates nothing; real run creates,
  second run `changed=0`; a sudo user (group or sudoers.d entry) is refused in check and real mode with its password
  status unchanged; `server.yml`'s first play refuses the same and reports a missing user in check mode.
- CI job "host playbooks converge" green with the new steps.
- `npm run typecheck`, `npm run lint` green.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
