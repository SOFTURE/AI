---
change_id: host-operator-keys
title: "host: operator add-key, remove-key and list for forced-command operator keys (issue #1433)"
status: in_progress
roadmap_item: null
issue: 1433
branch: claude/project-thread-2u0li3
created: 2026-11-23
updated: 2026-11-23
---

## Intent

An operator binds their own SSH key to an app's `deploy.sh` with one supported command, instead of editing the deploy
user's `authorized_keys` by hand, and learns which key to create and which commands that key then runs.

## Context

Issue #1433 (labels `pkg: host`). `app add` writes only the release key line
`command="/srv/<slug>/deploy.sh",restrict <key> <slug>-release` (the collection's `deploy_user` role, matched by its
comment). Operator commands (`status`, `cleanup`, `run`, `report`) go through the same forced command, so the operator
needs a line of the same shape.

## Scope

- `softure-host operator add-key --inventory --app --key [--name] [--check]`,
  `operator remove-key --inventory --app [--name] [--check]`, `operator list --inventory --app`.
- A playbook `ansible/operator.yml` that adds, replaces or removes exactly one line by its comment
  `<slug>-operator-<label>` and refuses a key already present on another line.
- README "Running operator commands" (host) and a pointer from the deploy README's operator setup step.
- Unit tests and the `e2e/converge.sh` scenario (idempotence, other lines untouched, shell refused, check mode).

## Constraints

- No line the command does not own is ever changed; the release key line is never matched.
- Every operator line carries `restrict` and the app's forced command; the deploy user gains no other access.
- No change in an adopting app's repository.

## Notes

- frame skipped: the issue names the gap and the fix; no product question.
