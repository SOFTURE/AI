# Plan review: host-survey-onboarding-preflight

Verdict: approved with two fixes applied.

## Findings

1. **Blocker (fixed): a drop-in on a server without AllowUsers.** Writing `AllowUsers deploy` where sshd had no
   `AllowUsers` would lock everyone else out. The plan writes it only when `AllowUsers` is already set (step 4).
2. **Warning (fixed): the preflight order.** `prepareEnvironment` creates the Environment in a real run; the
   preflight must run before it, so a stopped run changes nothing anywhere (step 3).
3. **Warning: sudo for the probe.** Docker and `sshd -T` need root or the docker group; the admin may lack
   passwordless sudo. The probe falls back (config files, Docker skipped) and says so; Ansible needs passwordless
   become anyway, so `app add` would fail later in that case. Decision: keep.
4. **Suggestion: POSIX sh.** The probe runs under `sh` (dash on Ubuntu): no arrays, no `[[`, `printf` for tabs.
   `converge.sh` stays within bash 3.2 (no associative arrays).
