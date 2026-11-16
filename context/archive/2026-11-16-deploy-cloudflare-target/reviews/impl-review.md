# Implementation review: deploy-cloudflare-target

Reviewed the diff against `plan.md` (three phases, the plan review's fixes) and the change's constraints.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A first deploy that verifies red has no earlier version: `wrangler rollback` fails too. The job is red either way and the report names verify. | Accepted as is; the README says the rollback deploys the previous version. |
| 2 | Warning | The secret values the caller passes in the step's `env:` are visible to every step of the composite action, the build and the migration included, as in the VPS action. | Accepted: the same model as `.github/actions/deploy` (SOFTURE/AI#468); only the deploy step writes them, to a mode-600 file removed in every case. |
| 3 | Suggestion | An error message once held `${{ secrets.NAME }}` inside a script, which GitHub would have parsed as an expression. | Fixed before commit; the shape test now fails on any `${{` in a script. |
| 4 | Suggestion | A Durable Object re-export in the generated `worker.ts` would break the bundle of an app whose OpenNext build does not export those classes. | Fixed: left as a comment for an app that caches through them. |

Plan drift: none beyond the recorded decisions (a composite action instead of a reusable workflow, secrets with the
deploy instead of `wrangler secret bulk`, no R2 binding, release 0.7.1).

Evidence: `npx vitest run tests/repo tools/deploy` (82 files, 2044 passed); `tools/deploy/tests/init-cloudflare.test.ts`
(19) and `tests/repo/deploy-cloudflare-action.test.ts` (27, fake `wrangler` and `npx`, a throwaway git repository for
the tag check); typecheck, ESLint and the language gate clean. The macOS workflow now runs the action's tests with the
system bash 3.2.

Verdict: approve.
