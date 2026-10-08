# Research: deploy-integration-run

Input: change.md, issue #248, research.sources. Depth: normal.
Snapshot: cefd4a7 on claude/project-thread-of4fxl, 2026-10-08 09:20 UTC.

## Summary

The contract is fixed by the skill script `wt-integration.sh`, so the commands only have to meet it. FIRE_TRACKER,
the `research.sources` entry that holds the original scripts, is not reachable from this session (only SOFTURE/AI is
cloned), so the implementation follows the issue's description and the skill's contract, not FIRE's code. The
package already has the patterns needed: git through `execFile` with checked refs (`src/notes/git.ts`), commands
that print and fail through `CliFailure` with an exit code (`src/cli/failure.ts`), and reusable workflows that keep
write permissions in a job of their own (`deploy-report.yml`). The new workflow can be named `deploy-*.yml` so the
existing guard tests cover it.

## Current state

- `wt-integration.sh:2-26` states the contract: `integration.lookup` prints the stored result for `INTEGRATION_SHA`
  and exits 0 green, 1 red, 3 none; `integration.remote` gets `INTEGRATION_NAME`, `INTEGRATION_SHA`,
  `INTEGRATION_WAIT_MINUTES` in the environment and exits 0 green, 1 red or could not start, 75 no result in time;
  optional stdout lines `integration: green|red`, `counts: <passed>/<total>`, `run: <url>`, `flaky: <test>`,
  `red: <test>`, `new-red: <test>` ("red and absent from the latest result on the main branch; when the command
  cannot tell, it prints none and every red counts as new").
- `wt-integration.sh:55-63`: a lookup exit 0 reuses the result (stdout printed, stderr dropped); any other exit runs
  the remote command. `:65-71`: the remote command runs from the repository root through `bash -c`; exit codes other
  than 0/1/75 count as red.
- `context/workflow.json:9-12` (this repo): `integration.local` = `npm run e2e`, `remote: null`. The skills'
  `WORKFLOW.md:47-53` documents `remote` as "e.g. a script that runs the suite on CI and waits".
- `tools/deploy/src/cli/run.ts:44-53`: commands are a word map (`"env render"` is two words), so
  `"integration run"` and `"integration lookup"` fit without a new dispatcher.
- `tools/deploy/src/cli/failure.ts:5-20`: `fail(message, exitCode)` prints one line on stderr and sets the exit code.
- `tools/deploy/src/notes/git.ts:9-24`: `isSafeRef` and `execFileSync` with an argument list, never a shell.
- `.github/workflows/deploy-report.yml:1-9`: write permission (`contents: write`) is given to one small job, never to
  the job that runs app code.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Library | `tools/deploy/src/integration/*` (new) | note format, contract lines, JUnit counts, git reads and writes, run and lookup |
| CLI | `tools/deploy/src/cli/integration-command.ts` (new), `src/cli/run.ts` | `integration run`, `integration lookup`, `integration record` |
| Exports | `tools/deploy/src/index.ts` | library functions, as for the other parts |
| Workflow | `.github/workflows/deploy-integration.yml` (new), `tools/deploy/examples/integration.yml` (new) | the CI side and its caller |
| Guards | `tests/repo/deploy-workflows.test.ts` | `contents: write` map, version default, the new workflow's shape |
| Docs | `tools/deploy/README.md`, `tools/deploy/CHANGELOG.md` | section, exit codes, `## Unreleased` |

## Data

No database. The stored data is one git note per tested commit under `refs/notes/integration`, a JSON object. Git
keeps one note per commit per notes ref, so a newer run on the same SHA replaces the older note.

## Tests

`npm test` runs `tools/deploy/tests/*.test.ts` and `src/**/*.test.ts`. The CLI tests already create temporary git
repositories (`tools/deploy/src/notes/git.test.ts`), so `run`, `lookup` and `record` can be tested against a local
bare repository as the remote, with no network. `tests/repo/deploy-workflows.test.ts` parses every
`.github/workflows/deploy-*.yml` and runs step scripts with stand-in commands (`npx` stub, lines 160-180).

## Patterns to follow

- Command shape and flags: `release-report-command.ts:22-52` (`readFlags`, `fail` with `USAGE_EXIT_CODE`).
- Git: `git.ts` (`execFileSync`, `assertSafeRef`, exit status checks).
- Workflow: validated inputs passed through `env`, never `${{ inputs.* }}` inside `run` (guard test lines 95-101);
  CLI from npm as `npx --yes --package=@softure-ai/deploy@$DEPLOY_CLI_VERSION softure-deploy …` (lines 160-180).

## Prior work

- `context/archive/2026-10-06-deploy-fire-parity/research.md`: FIRE's release scripts compared with the package; the
  integration run was out of that scope ("its gates and integration suite inside the release run" stay in the app,
  README "Parity with FIRE_TRACKER").
- `context/archive/2026-10-04-deploy-release/`, `2026-10-05-deploy-reusable-workflows/`: how the reusable workflows
  and their guard tests came to be.

## SOFTURE modules

Covered partly by `@softure-ai/deploy` itself (git helpers, CLI scaffolding, workflow conventions); the change
extends it as the issue proposes. No other module applies.

## Risks

- **A run waits for a stale note** (a red result already stored for the SHA): `run` must wait for a note other than
  the one present before it pushed. Mitigation: compare the note text read before the push.
- **Two sessions push the same name**: a ref that already points at another commit is a run in progress; `run`
  refuses (exit 1, "could not start") rather than replacing it. The same commit is the same run: wait for it.
- **Two workflows write notes at once**: the notes push is rejected as non-fast-forward. Mitigation: fetch, re-add
  the one note, push again, a few attempts.
- **App code with a write token**: the suite runs in a job with `contents: read` and no stored credentials; only the
  record job (no app code) gets `contents: write`.
- **The CLI default version lacks the commands until the next release**: the workflow's `deploy-cli-version`
  default is the package version, as for the other workflows; the version bump moves it.
- In-flight #246 and #247 edit `@softure-ai/deploy` too: conflicts limited to additive lines.

## Relevant lessons

None in `context/foundation/lessons.md` names integration runs; the deploy lessons on keeping write permissions in a
separate job are already in `deploy-report.yml`.

## Answers to unknowns

- Where does the contract live? `wt-integration.sh:2-26` (answered).
- How are counts and test names obtained from an arbitrary app's suite? From an optional JUnit XML report: Vitest and
  Playwright both write one (decided, plan).
- How does `new-red` find "the last main-branch result"? The newest first-parent commit of `<remote>/<main>` that
  carries a note; with none, no `new-red` lines (the contract's "cannot tell") (decided, plan).
- Does lookup need the network? It fetches the notes ref from the remote first; when the fetch fails it reads the
  local notes (decided, plan).

## Open questions

- FIRE_TRACKER's exact note fields: not readable here → decided (auto): a JSON note of our own, versioned
  (`version: 1`), since only the printed contract is shared with the skills.
- Branch and notes names → decided (auto): `integration/` and `refs/notes/integration` (English rule, AGENTS.md).

## Decisions (auto)

- Depth normal: no money, data or auth; a CI workflow with a write token is the one sensitive part, handled by the
  job split.
