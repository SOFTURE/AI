# Plan review: deploy-run-ops-on-server

Reviewed: plan.md against change.md, issue #247 and the code on master `cefd4a7`.
Verdict: **approve after fixes** (applied to plan.md).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | The issue proposes shipping the script to the server. A forced command that accepts code on stdin turns the operator key into "run anything against production", and the code run would not be the code a release reviewed. | Fixed: scripts are bundled into the image at build time and only named over SSH (key decision 1). Reports still arrive as SQL on stdin, but only to a read-only transaction (finding 2). |
| 2 | Warning | "Read-only report" over a superuser connection is only as strong as a session setting the SQL could turn off. | Fixed in part: the report connects as `softure_app` (no DDL, no roles), with `default_transaction_read_only=on` and `--single-transaction`, so a mistaken write fails and nothing commits. The rest is stated plainly in the README: a guard against mistakes, not a sandbox. A dedicated read-only role is out of scope (it needs an initdb change and a manual step on every existing database). |
| 3 | Warning | `SSH_ORIGINAL_COMMAND` is split on blanks, so a value with a space would arrive as two words and the script would see a stray argument. | Fixed: the client refuses a value with whitespace before connecting and points at `--<key>-file`; the gateway refuses any word that is not `--<key>[=<value>]`. |
| 4 | Warning | `--<key>-file=<path>` given to `run` names a path on the operator's machine; the container would not find it, and the operator would be tempted to put the secret inline instead. | Fixed: the client reads one such file and sends it on stdin as `--<key>-file=-` (key decision "stdin"). |
| 5 | Suggestion | A script running during a deploy's switch could hit a container that is being replaced. | Fixed: `run` takes the deploy lock; `report` (read only) does not, like `status`. |
| 6 | Suggestion | `report` could get its own result format. | Out of scope: psql's aligned table is what FIRE prints today. |
| 7 | Check | `npm test` runs the generated `deploy.sh` on macOS too: the new blocks use no associative arrays, no `${var,,}`, no `mapfile`, and `head -c`/`wc -c` which both BSD and GNU accept. | No change. |

No lesson ignored.
