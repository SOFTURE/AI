# Plan: host-survey-onboarding-preflight

## Approach

1. `src/survey/`: `probe.ts` (the POSIX sh probe, run as `ssh … admin@host sh -s -- <deployUser> <firewallName>`
   with the script on stdin; privileged reads through `sudo -n` when the admin has it), `facts.ts` (parse the
   tab-separated lines into `ServerFacts`, unknown lines ignored), `report.ts` (the survey text and the suggested
   `edge:` block), `preflight.ts` (`findOnboardingProblems(facts, inventory, compose)`: pure, returns problems and
   notes). The admin SSH arguments move to one helper shared with `readHostKeys`.
2. `softure-host survey --inventory=<file>` (`src/cli/survey-command.ts`, usage text).
3. `app add`: probe and compose file first, then the preflight; problems stop the command with every problem listed
   and "nothing was changed", before the GitHub Environment; Docker that cannot be read skips the edge checks with
   one line.
4. `ansible/tasks/deploy-user-sshd.yml`: read-only probe (`sshd -T -C user=<deploy>,…`, glob match like sshd), refuse
   Deny*/AllowGroups conflicts before any change (pre_tasks, after the sudo preflight); in tasks, a drop-in when
   `AllowUsers` is set without the deploy user, `sshd -t`, reload (`ssh`/`sshd` unit or `HUP` to `/run/sshd.pid`),
   removed and failed on a bad config.
5. `e2e/converge.sh`, README section + link at the top, usage, CHANGELOG `## Unreleased`.

## Decisions (auto)

- `${EDGE_NETWORK…}` in the compose file resolves to the inventory's `edge.network`, since `app add` sets that
  variable (#1429); only a literal or another variable's default that differs stops the run.
- An edge "is the inventory's own" when its compose project (or container name prefix) is `edge.name`; any other
  Traefik with `edge.manage: true` stops `app add`.
- When Docker cannot be read (no Docker, or no access), the edge checks are skipped with a printed line instead of
  stopping: there is nothing to contradict, and `server` installs Docker on a fresh server.
- AllowGroups/DenyUsers/DenyGroups are reported as the step left (stop before change), never edited: widening them
  would change who else may log in.
- The survey's e2e runs the real CLI over SSH as root against the converge container; its host key is added to the
  runner's `known_hosts` and removed on exit (ssh reads the passwd home, not `$HOME`).

## Phases

1. Survey probe, parser, report, `survey` command, unit tests.
2. Onboarding preflight in `app add`, unit tests.
3. sshd drop-in in `app.yml`, `e2e/converge.sh`, README, CHANGELOG.

## Acceptance

- Unit tests: probe output parsed; survey prints the sections and the suggested `edge:` block; `app add --check`
  with a foreign edge and `edge.manage: true` stops with the message pointing at `edge.manage: false` and makes no
  GitHub write; a literal compose network that differs names both networks; a missing `edge.network` lists the
  server's networks; `${EDGE_NETWORK:-other}` passes.
- `e2e/converge.sh` locally (Docker in this container) and in CI job "host playbooks converge": the deploy user logs
  in on an `AllowUsers root` server after `app.yml`, second run `changed=0`, AllowGroups refused before change,
  `survey` changes nothing.
- `npm run typecheck`, `npm run lint`, `npx vitest run tools/host` green.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
