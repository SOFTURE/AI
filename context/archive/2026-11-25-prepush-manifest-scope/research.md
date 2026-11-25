# Research: prepush-manifest-scope

- `scripts/test-changed.mjs` (pre-push, `npm run test:changed`): `findFullSuiteFile(files, FULL_SUITE_PATTERNS)`; a hit
  runs `vitest run` (about 23 minutes locally). Release bumps change `tools|modules/<pkg>/package.json` and
  `package-lock.json`, so every release push pays it.
- `scripts/ci/affected.mjs` exports `getTestScope({ changed, packages })`: `{ kind: "all" }` for a shared root file
  (`SHARED_PATHS`: root `package.json`, `.npmrc`, root tsconfigs, `vitest.config.mts`, `eslint.config.mjs`, `scripts/`,
  CI workflows) or a lockfile change whose reach is unknown or total; else the reached package folders plus `tests/`.
  ci.yml's test job runs `npm test -- --shard --passWithNoTests $files` with those paths on a pull request.
- `getLockfileReach({ before, after, workspaces })` (scripts/ci/lockfile-changes.mjs) needs both lockfiles; CI reads
  the base one through the GitHub API, locally `git show <base>:package-lock.json` gives the same.
- `findWorkspaces(root)` (scripts/build-workspaces.mjs) gives the packages with every dependency kind, as CI uses for
  the test scope.
- Vitest `--changed` reruns everything when a `package.json` changes (default `forceRerunTriggers`), so the narrowed run
  passes explicit paths instead.
- The `@softure-ai/config` preset does not use `scripts/test-changed.mjs`; its pre-push runs `npm test` on every push
  except merge-only pushes (`softure-merge-push-scope`).
