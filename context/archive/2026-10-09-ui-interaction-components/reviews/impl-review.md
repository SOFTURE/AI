# Implementation review: ui-interaction-components

Reviewed: the branch diff against plan.md, change.md and issue #319.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. Six components in their own files, exported from `src/ui/index.ts`; copy in `src/messages/{en,pl}.ts`. | No change. |
| 2 | Check | Tests in `tests/adoption-gaps-319.test.tsx` (27) fail on master (the exports are missing) and pass after. Turning the outside-press listeners to the bubble phase makes the capture-phase test fail, so it pins the behaviour the issue calls hard-won. | No change. |
| 3 | Check | No inline copy and no raw colours (architecture test green); `ui/` imports no framework (`closeKey` carries the route). | No change. |
| 4 | Check | Every failure path is handled visibly: a rejected confirm action and a refused clipboard write are logged and shown; blocked storage is caught and documented. | No change. |
| 5 | Suggestion | `ConfirmActionButton` takes only message results, not error codes like `ActionForm`. | Kept: the issue asks for the server message to reach the toast; an app with codes maps them in its action. |
| 6 | Check | The compiled CSS has the new utilities (`ring-foreground`, `top-full`, `min-w-48`, `[hidden]`); `styles.css` is 6.1 kB gzip (budget 20 kB). | No change. |

Gates: `npm run typecheck`, `npm run lint`, `npm run build`, the ui and repository tests green; the full `npm test`
runs in pre-push.
