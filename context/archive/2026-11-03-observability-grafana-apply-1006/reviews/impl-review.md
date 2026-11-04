---
change_id: observability-grafana-apply-1006
verdict: approved
---

# Implementation review: observability-grafana-apply-1006

- Plan followed: both phases (3bda772, 5846cd5); scope stays in `foundation/observability`, no adopting app changed.
- All four proposals of #1006 are covered: command and `/node` function, exported schema, the three common rules
  (silent app and silent worker through one builder, log problems), `--paused`.
- Writes happen only after every read succeeded and the contact point exists, so a refusal or a read failure leaves
  Grafana untouched. A failure after the folder was created reports the created folder in `steps` (re-running is
  safe: the folder then exists).
- The group `PUT` deletes rules missing from the file; the dry run and the commit both name them. Documented in the
  README in bold.
- The token is sent only in `Authorization`; errors carry method, path (no query) and status plus at most 300
  characters of Grafana's answer. A test asserts the bearer header and the error text.
- Builders: selectors are JSON-quoted (PromQL and LogQL accept that escaping), regex metacharacters in severities are
  escaped, uids are stable 16-hex digests under Grafana's 40-character limit.
- Types: `GrafanaApplyResult` is a discriminated union; external JSON enters as `unknown` and is narrowed by zod.
- Gates: typecheck and ESLint (pre-commit) green, language gate green, the package's tests green; the full suite runs
  in the pre-push hook. Approved.
