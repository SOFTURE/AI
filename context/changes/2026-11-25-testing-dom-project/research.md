# Research: testing-dom-project

## Question
How can `softureVitestConfig` run `*.dom.test.*` files in a DOM while every other test keeps running in node, when the
app merges its own `include` on top of the preset?

## Findings
- `foundation/testing/src/vitest/preset.ts` returns `{ plugins, test: { server.deps.inline, setupFiles } }`; the app
  merges its config with `mergeConfig`, which concatenates arrays.
- Vitest 5.1.1 removed `environmentMatchGlobs`; choosing an environment by file name needs `test.projects` (or a
  docblock per file, which this repository uses in `foundation/ui/tests/*.test.tsx`).
- Inline projects with `extends: true` inherit the root config, and their arrays are merged too: a `dom` project's
  `include` is added to the app's root `include`, not put in its place (measured in a scratch app: the `dom` project
  also ran `a.test.ts`). Only `name`, `projects`, `root` and `globalSetup` are not inherited.
- The `dom` project can still be limited to `*.dom.test.*` with an extglob in `exclude`:
  `**/!(*.dom.test).?(c|m)[jt]s?(x)`. A pattern without the extension (`**/!(*.dom.test.*)`) also matches directory
  names and prunes the whole tree (measured: no dom test ran). With the extension: every file ran exactly once in the
  right project, in nested folders, with `.test`, `.spec` and `.check` names in the app's `include` (measured).
- An `exclude` set in the config replaces Vitest's default (`configDefaults.exclude`), so each project lists it again.
- Root `setupFiles` are inherited, so the clock setup file runs in both projects; the `dom` project adds its own.
- `@testing-library/react` 16.3.3 sets `IS_REACT_ACT_ENVIRONMENT` itself but registers its automatic cleanup only
  when `afterEach` is a global (`globals: true`); an explicit `afterEach(cleanup)` in the setup file covers both.
- happy-dom 21.0.4, `@testing-library/react` 16.3.3 and `@testing-library/dom` 10.4.2 are root devDependencies;
  `@testing-library/user-event` is not installed (latest 14.6.1, peer `@testing-library/dom >=7.21.4`).
- Optional peers are the package's pattern for test tools an app may not use (`vitest`, `pg`, `@playwright/test`).
