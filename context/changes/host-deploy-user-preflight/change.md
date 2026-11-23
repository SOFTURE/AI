---
change_id: host-deploy-user-preflight
title: "host: refuse a sudo deploy user before any change, and dry-run a first onboarding (issue #1431)"
status: planned
roadmap_item: null
issue: 1431
branch: claude/project-thread-6j5uoi
created: 2026-11-23
updated: 2026-11-23
---

## Intent

`softure-host` rejects a deploy user that is the admin or has sudo rights before it changes anything on the server,
in a real run and in `--check` alike, and `app add --check` on a server where the deploy user does not exist yet
passes and reports the user, its key file, the key line and the app folder as planned changes.

## Context

Issue #1431 (no labels). The collection's `deploy_user` role creates the user with `password_lock: true` before its
own sudo check, and that check is skipped in check mode; `server.yml` runs the whole bootstrap before the role. In
check mode the role's later tasks and the app folder tasks read a user and files that only the real run creates.

## Scope

- Inventory schema: `server.deployUser` must differ from `server.adminUser`.
- A shared Ansible preflight (`ansible/tasks/deploy-user-preflight.yml`): reads the deploy user's groups and
  sudoers entries and refuses `sudo`/`wheel`/`admin` membership or a sudoers entry, as the first task of `app.yml`
  and as a first play of `server.yml` (before the bootstrap), tagged `always`, also in check mode.
- Check mode: when the deploy user or its `authorized_keys` does not exist, the `deploy_user` role and the tasks that
  need the user are skipped and one task reports them as planned changes.
- `e2e/converge.sh`: a sudo deploy user is refused with no change (check and real run); a first onboarding passes
  in check mode and changes nothing.
- README and CHANGELOG of `@softure-ai/host`.

## Constraints

- No change in the `softure.vps_foundation` collection (another repository); the guard lives in this package's
  playbooks, before the collection's role runs.

## Notes

- frame skipped: the issue names the defect, the impact and the fix; no product question.
