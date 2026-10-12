---
change_id: deploy-report-role
status: open
---

# Plan: deploy report role (issue #383)

Input: change.md, research.md. Complexity: small (one optional answer, one flag, tests, docs).

## Phase 1: the `reportRole` answer and `--report-role` (TDD)

Files: `tools/deploy/src/init/{answers,compose-facts,generate}.ts`, `src/cli/init-command.ts`; tests
`src/init/answers.test.ts`, `src/init/generate.test.ts`, `tests/init-cli.test.ts`.

1. Tests first, red on master:
   - `parseInitAnswers` accepts `reportRole: "ledger_app"` and refuses `"ledger-app"`, `"1app"` and `"a;b"` with a
     `reportRole:` problem.
   - `planInitFiles` with `reportRole` writes `REPORT_ROLE=<it>` even when the facts carry another compose role.
   - CLI: a kept compose file whose URL is a variable plus `--report-role=ledger_app` writes
     `REPORT_ROLE=ledger_app` and prints only the Postgres warning; the role warning without the flag names
     `--report-role`; `--force` with the flag writes the flag's role; an invalid value writes nothing.
2. Implement: export the `ROLE` pattern from `compose-facts.ts` as `POSTGRES_ROLE`; `reportRole` optional in
   `initAnswersSchema`; `getReportRole(answers, facts, replacesCompose)` puts the answer first; `runInit` reads
   `--report-role`; `listComposeWarnings` skips the role warning when the answer is given and names the flag.

## Phase 2: docs

`tools/deploy/README.md` (`init` usage line and the read-from-the-app paragraph), `tools/deploy/CHANGELOG.md`
(`## Unreleased`).

## Progress

- [ ] Phase 1: the `reportRole` answer and `--report-role`
- [ ] Phase 2: docs
