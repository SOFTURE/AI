# Implementation review: deploy-run-ops-on-server

Reviewed: the branch diff against plan.md (decisions and phases) and change.md's constraints.
Verdict: **approve after fixes** (applied).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | The stub `docker` first matched `test -f ops/<name>` with `${*##* ops/}`, which strips each positional word, not the joined line, so every script looked missing and the happy path never ran. | Fixed in the test stub (`${!#}`, the last word); the run tests now go through `exec ... node ops/<name>.mjs` and assert the exact docker calls. |
| 2 | Warning | A refusal of a bad script name came before `reports_result` was cleared, so it printed a `result|failed|command|…` line while the other run/report refusals printed none. | Fixed: `reports_result` is cleared as soon as the command is `run` or `report`; only `run` without a script (caught by the command-line `case`) still prints the command refusal line, like every other malformed command. |
| 3 | Warning | Nothing proved that a word with shell syntax stays inert on the server. | Fixed: a test sends `$(touch${IFS}pwned)` and a backquoted word; both reach docker verbatim and no file appears. |
| 4 | Warning | `CliIo.stdin` piped from `process.stdin` would keep an interactive CLI alive after ssh exits. | Fixed: `main.ts` leaves `stdin` unset and ssh inherits the terminal; tests pass a stream. |
| 5 | Suggestion | The README's Dockerfile lines repeat the esbuild version of `TEMPLATE_VERSIONS`. | Kept: the same holds for the migrate lines an older app copies; a version bump of the template updates both. |
| 6 | Check | Phase "done when" items: typecheck, lint (ESLint + language gate), `npm test`, build green. | See Progress in plan.md. |
| 7 | Check | bash 3.2: the new blocks use `${array[@]+...}` for empty arrays (`set -u` on 3.2), `${words[@]:2}`, no associative arrays or `mapfile`; `head -c`, `wc -c`, `sed -n`, `tr` with flags both BSD and GNU accept. | No change. |

No lesson ignored.
