# Implementation review: host-survey-onboarding-preflight

Verdict: approved, no change needed.

## Findings

1. **Checked: the preflight runs before every write.** `app add` reads the compose file (GitHub read) and runs the
   probe (read-only SSH) before `prepareEnvironment`; the CLI test asserts no `gh api -X`, `secret set`,
   `variable set`, Environment call or playbook on a stopped run, with and without `--check`.
2. **Checked: the own edge.** The collection's `traefik_edge` template sets the compose `name:` to
   `traefik_edge_name` (`edge.name`), so a server `softure-host server` provisioned passes `isInventoryEdge`.
3. **Checked: the drop-in cannot narrow access.** It is written only when `AllowUsers` is already set (probe
   `allowusers missing`); AllowUsers directives accumulate (measured with OpenSSH 9.6), and `sshd -T` after writing
   must list the deploy user, otherwise the rescue removes the file.
4. **Suggestion, not done: compose labels.** The preflight does not compare the app's router labels
   (`tls.certresolver`, entry point) with the running edge; the issue's preflight list does not ask for it and the
   survey prints both. Left as is.
5. **Checked: shell portability.** `probe.sh` passes `sh -n` under dash; `converge.sh` uses no bash 4 features.
