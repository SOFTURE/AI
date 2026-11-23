---
change_id: host-operator-keys
verdict: approved
---

# Implementation review

Reviewed the diff against `plan.md` and issue #1433.

- **Acceptance (unit):** `tools/host` suite green with the new tests; typecheck and lint green.
- **Acceptance (e2e):** `e2e/converge.sh` PASS locally: add-key twice with one label leaves one line and changes
  nothing the second time, another app's line and a hand-added line stay byte-equal, the key logs in only through
  `deploy.sh` (a shell command and a bare login both land in it), `--check` changes nothing and shows the line.
- **Safety:** the playbook writes only `command="/srv/<slug>/deploy.sh",restrict <type> <body> <comment>` built from
  validated parts (type from a fixed list, base64 body, slug and label from strict patterns), matched by
  `\s<slug>-operator-<label>$`; labels without dashes and not `release` cannot match the role's release regexp or
  another app's comment. A key body on any other line is refused on the server, inside the run that would write.
  `authorized_keys` stays owned by the deploy user, 0600. The deploy user gains no group, shell or sudo.
- **Read path:** `list` runs one fixed command (`sudo -n cat ~<deployUser>/...`, the user name from the inventory
  pattern) over the admin's BatchMode connection; a line under the operator comment without the forced command is
  flagged, not trusted.
- **Docs:** README section with key creation, usage and `~/.ssh/config` alias; deploy README points to it; CHANGELOG
  carries the migration note.
- Release: `@softure-ai/host` minor-level feature, rides the next host release (CHANGELOG `## Unreleased`).

Findings: none.
