# @softure-ai/config

The tooling config every SOFTURE app shares: an ESLint flat config preset, a tsconfig base, git hooks for
lefthook and the language gate (`softure-check-language`). One place to change a rule for every app, so the copies
stop drifting.

```bash
npm install --save-dev @softure-ai/config eslint @eslint/js typescript-eslint globals lefthook
```

The ESLint packages are optional peers: an app that only wants the language gate or the tsconfig skips them. The
preset runs on ESLint 9.22 or later and on ESLint 10; a Next.js app stays on ESLint 9 until the plugins in
`eslint-config-next` support 10. Keep one copy of `typescript-eslint` (`npm ls typescript-eslint`): when a config in
`extends` registers its own `@typescript-eslint` plugin, the preset reuses it, but its rules come from the copy the app
installed.

## ESLint

```js
// eslint.config.mjs
import nextVitals from "eslint-config-next/core-web-vitals";
import { createSoftureEslintConfig } from "@softure-ai/config/eslint";

export default createSoftureEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  extends: [...nextVitals],
  fixtures: { module: "./fixtures", exempt: ["e2e/fixtures.ts"] },
});
```

| Option | Default | What it does |
|---|---|---|
| `tsconfigRootDir` | (required) | The folder of the app's `tsconfig.json`, for the type-checked rules. |
| `extends` | `[]` | Configs placed after the base rules (Next's flat configs, the app's own rules); they win. |
| `ignores` | build output | Extra ignored paths; `dist/`, `.next/`, `next-env.d.ts`, `coverage/` and the Playwright reports are always ignored. |
| `integration` | `{ files: ["integration/**"], appSource: ["@/*"] }` | Integration tests are a black box: no import matches `appSource` (gitignore-style patterns, as in `no-restricted-imports`). Add relative patterns such as `"**/lib/**"` when the tests could reach the source without the alias. `false` turns it off. |
| `fixtures` | off | `{ module, files?, exempt? }`: tests (`e2e/**` and `integration/**` by default) import `test` from `module`, not from `@playwright/test`; `expect` and the rest stay allowed. `exempt` names the fixtures file itself, which has the import rule off. |

The type-checked rules cover TypeScript files (`.ts`, `.tsx`, `.mts`, `.cts`), which typescript-eslint's parser
reads with `projectService`. That parser is set after `extends`, so Next's own parser cannot take its place; an app
tunes it by passing other `parserOptions` for those files in `extends` (only `projectService` and `tsconfigRootDir` are
fixed). JavaScript files (`*.config.mjs`, scripts) get the recommended JavaScript rules and whatever `extends` adds,
without type information. A TypeScript file outside the app's `tsconfig.json` `include` fails with "was not found by
the project service": add it to `include` or to `ignores`.

Run ESLint with `--max-warnings 0`: a warning that passes locally fails CI. The type-checked rules make a full run
slower (a large app takes a minute or more), and an app adopting the preset meets errors its old config let through
(`no-unnecessary-type-assertion`, `no-base-to-string`, `require-await`, `no-unsafe-*`): fix them, or turn a rule off in
`extends` for a while and record why.

## tsconfig

```json
{
  "extends": "@softure-ai/config/tsconfig.json",
  "compilerOptions": { "plugins": [{ "name": "next" }] },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

The preset holds compiler options only: `include` and `plugins` resolve relative to the file that declares them, so
they stay in the app. It targets ES2023, the target the `@softure-ai/*` packages are built and tested for.

The base sets `noUncheckedIndexedAccess`, which an app written without it meets as many errors at once (an index or
`Record` read is `T | undefined`). An app that adopts the base before fixing them overrides that one option for a while:

```json
{ "extends": "@softure-ai/config/tsconfig.json", "compilerOptions": { "noUncheckedIndexedAccess": false } }
```

## Git hooks (lefthook)

```yaml
# lefthook.yml
extends:
  - node_modules/@softure-ai/config/presets/lefthook.yml
```

| Hook | Jobs |
|---|---|
| `pre-commit` | `tsc --noEmit`, ESLint on the staged files, the language gate on the staged files (in parallel; a Markdown-only commit skips the first two) |
| `commit-msg` | the language gate on the message |
| `pre-push` | `tsc --noEmit`, `eslint .`, the language gate on every tracked file, `npm test` (stops at the first failure); a push that changes only `context/` runs the language gate alone; a push that only merges the tested main branch in runs `vitest related` for the branch's files instead of `npm test` |

A push of workflow artifacts alone (roadmap or change state under `context/`) skips typecheck, ESLint and the tests:
their `skip` condition is `npx softure-context-only-push`, which exits 0 only when every file the push of the current
branch changes (`git diff @{push} HEAD`, so a merge that brings in code counts) is under `context/`. A branch without
upstream, nothing to push, or a git error runs everything. ESLint runs without `--cache` on purpose: the rules are
type-aware, and the cache keys a file by its own content, so a type change in one file would leave stale results for
the files that use it.

### A push that only merges the main branch in

Right before a change branch is merged, the main branch has often moved, and the branch pushes nothing but that merge.
The incoming code is tested on the main branch and the branch's own code was tested at its last push, so the full
suite would only repeat both. For such a push the `test` job is skipped (`npx softure-merge-push-scope is-merge`) and
the `test-related` job runs `npx vitest related --run --passWithNoTests <files the branch changes>` instead
(`git diff --name-only <merge base with the main branch> HEAD`, deletions left out). Typecheck, ESLint and the language
gate run as on any push. CI and the release gate keep running the full suite.

`softure-merge-push-scope` calls a push a merge only when every new commit of `@{push}..HEAD` that is not already on
the upstream main branch either touches only `context/` or is a merge whose other parents are on the upstream main
branch, and at least one such merge is there. The full suite runs instead when:

- the branch pushes code of its own, merges another branch, or merges main-branch commits not yet on the remote;
- the merge brings in (`git diff @{push} HEAD`) a migration (`migrations/`, `*.sql`, `prisma/`, `drizzle/`), a
  dependency manifest, lockfile or runtime pin (`package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`,
  `bun.lock`, `.npmrc`, `.nvmrc`, …), a test setup (`vitest.config.*`, `vite.config.*`, `playwright.config.*`,
  `*.setup.ts`, `setup-tests.ts`, …) or a tool config (`tsconfig*.json`, `eslint.config.*`, `lefthook*.yml`,
  `next.config.*`, `.env*`, …);
- the merge brings in a file the app lists in its `package.json`:

  ```json
  { "@softure-ai/config": { "fullSuiteOn": ["db/**", "scripts/seed.ts"] } }
  ```

  (`**` any folders, `*` within one name, `?` one character, matched against the path from the repository root);
- the branch has no upstream, nothing new is pushed, no main branch is found, or git fails.

The main branch is `mainBranch` of `context/workflow.json` when the app has one, else the remote's `HEAD`, else
`main`, else `master`, on the remote the branch pushes to. A failing bin never skips the full suite: `is-merge` then
exits non-zero, so `test` runs (at worst `test-related` runs too).

An app whose tests run through another command gives it to `test-related` after `--`; the files are appended:

```yaml
# lefthook.app.yml
pre-push:
  jobs:
    - name: test-related
      run: npx softure-merge-push-scope related -- npx vitest related --run --passWithNoTests --project unit
```

An app that wants the full suite on every push drops the third speed in the same file:

```yaml
# lefthook.app.yml
pre-push:
  jobs:
    - name: test
      skip:
        - run: npx softure-context-only-push
    - name: test-related
      skip: true
```

Install the hooks from `prepare`, skipped when `CI` is set (lefthook 2 installs unconditionally, and a CI checkout
has no use for hooks):

```json
{ "scripts": { "prepare": "node -e \"process.exit(process.env.CI?0:1)\" || lefthook install" } }
```

To change a job, list a file of the app's own after the preset in `extends` and name the job there. lefthook merges
`extends` over the app's `lefthook.yml`, and a later file in `extends` over an earlier one, job by job (matched by
`name`), so the app's file wins and the jobs keep the preset's order. A job named in `lefthook.yml` itself does not
change what the preset sets: its `run` is ignored, and only a key the preset leaves out (such as `skip`) takes effect.

```yaml
# lefthook.yml
extends:
  - node_modules/@softure-ai/config/presets/lefthook.yml
  - lefthook.app.yml
```

A Next.js app generates its route types before the type check:

```yaml
# lefthook.app.yml
pre-commit:
  jobs:
    - name: typecheck
      run: npx next typegen && npx tsc --noEmit

pre-push:
  jobs:
    - name: typecheck
      run: npx next typegen && npx tsc --noEmit
```

An app that still has inline Polish copy outside `messages/` keeps the commit message check and skips the file checks
until the copy moves (a verbatim quote in Markdown needs no skip: mark it, see the language gate below):

```yaml
# lefthook.app.yml
pre-commit:
  jobs:
    - name: language
      skip: true

pre-push:
  jobs:
    - name: language
      skip: true
```

Run `npx lefthook dump` to see the hooks as lefthook merged them. Keep the second file out of `lefthook-local.yml`:
that is lefthook's file for one developer's own overrides, usually ignored by git.

## Language gate

```bash
npx softure-check-language <file>...             # these files
npx softure-check-language --all                 # every file git tracks
npx softure-check-language --commit-msg <file>   # a commit message
```

Code, comments, docs and commit messages are English (the rule `@softure-ai/skills` installs). Polish is allowed only
in a folder named `messages/` (user-facing copy) or `pl/` (Polish language data: word lists, test articles), and
lockfiles are skipped. A hit prints `path:line: reason` and the command exits with 1; wrong arguments exit with 2.
A diacritic always counts; a Polish word counts only on its own, not inside a path, slug or identifier, and Markdown
code spans are skipped.

A Markdown file can quote someone verbatim in their own language (the owner's words in a PRD or shape notes under
`context/`): mark the quote and the gate skips it, while the rest of the file stays checked. The markers are HTML
comments, so they do not show in the rendered page; they work on one line or around several lines, and a marker shown
in a code span is only text. An opening marker that is never closed is a hit on its line.

```markdown
The owner, verbatim: "<!-- language: pl -->...<!-- /language -->"

<!-- language: pl -->
> ...
<!-- /language -->
```

The functions (`findPolishText`, `checkFiles`, `isExempt`, `getCommitMessageText`) are
exported from `@softure-ai/config/language` for an app's own tests.
