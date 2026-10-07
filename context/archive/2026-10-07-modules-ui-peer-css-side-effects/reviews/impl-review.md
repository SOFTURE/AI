# Implementation review: modules-ui-peer-css-side-effects

Reviewed: the branch diff against `plan.md` (one phase), `change.md` and issue #167. Mode: autonomous.

Verdict: **approve** (one finding fixed during implementation, none open).

## Plan conformance

- D1: the eight modules list `@softure-ai/ui` under `peerDependencies` (`^0.1.0`) and `devDependencies` (`^0.1.7`),
  and no longer under `dependencies`.
- D2: two guards in `tests/repo/packages.test.ts`, seen red first (9 failures: the eight modules plus blog's
  `sideEffects`), green after the manifest change; ui and charts pass unchanged.
- D3: patch bumps auth 0.1.7, the other seven 0.1.6, in `package.json`, `module.json` and the manifest in
  `src/index.ts`.
- D4: blog README install line and `docs/02-module-standard.md` § Packaging.

## Findings

### I1 (Warning, fixed): the version also lives in each module's `src/index.ts`

**Evidence:** the first full `npm test` failed 12 tests in `modules/*/tests/module.test.ts` ("keeps the package
version and the manifest version in step"): the plan named `package.json` and `module.json` only.

**Fix:** bumped the `version` in each module's `src/index.ts`; the module and repository tests pass (25 files,
545 tests).

### I2 (Suggestion, fixed): the example app's lockfile carried the old manifests

**Evidence:** `examples/next-app/package-lock.json` keeps each linked module's version and dependency lists (an
earlier bump edited it by hand); it still listed ui as a dependency and auth's ops as a dependency.

**Fix:** the eight entries now mirror the current manifests (version, dependencies, peers, peer metadata);
`npm install --package-lock-only` there reports it up to date.

## Checks

- `npm run typecheck`, `npm run lint`: green. `npm test`: green apart from I1 before its fix; the failing files rerun
  green. `npm run build`: green. `npm pack --dry-run` in `modules/blog`: `@softure-ai/blog@0.1.6`.
- No module source behaviour changed: the only `src/` edits are the version strings.
- No release in this change (change.md § Constraints): #154 and #158 still change these packages.
