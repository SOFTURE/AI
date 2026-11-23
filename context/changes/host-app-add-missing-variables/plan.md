# Plan: host-app-add-missing-variables

## Approach

Add `listVariableNames(runner, repo, scope)` to `src/github/gh.ts` (repository or Environment variables, names only).
`prepareEnvironment` returns the Environment's secret names and variable names (the Environment's variables only when
it exists); `app add` also reads the repository variables and subtracts them, the Environment variables and
`plan.variables` from the missing names.

## Decisions (auto)

- One missing list instead of the issue's two: a name set nowhere has no kind. The line reads
  `still to set by hand (a production secret, or a repository variable for a value that is not secret): …`.
- Repository secrets are not subtracted: `app add` writes and reads Environment secrets only (unchanged scope).
- `prepareEnvironment` returns `{ secrets, variables }` instead of a bare set, so the "nothing under a missing
  Environment" rule stays in one place.

## Phases

1. Tests first (the issue's two acceptance tests in `cli.test.ts`), then `listVariableNames`, `prepareEnvironment`,
   the subtraction and the new line; README step 6 and CHANGELOG.

## Acceptance

- Test: compose requiring `${APP_HOST:?}` and `${MAIL_KEY:?}`, no secrets or variables: `app add` reports only
  `MAIL_KEY`.
- Test: an existing repository variable (and an Environment variable) is not reported as missing.
- The `--check` test still shows no read under a missing Environment (`gh variable list --env` included).
- `npx vitest run tools/host`, `npm run typecheck`, `npm run lint` green.

## Progress

- [ ] Phase 1
