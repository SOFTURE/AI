# @softure-ai/config

The tooling config every SOFTURE app shares: an ESLint flat config preset, a tsconfig base, git hooks for
lefthook and the language gate (`softure-check-language`). One place to change a rule for every app, so the copies
stop drifting.

```bash
npm install --save-dev @softure-ai/config eslint @eslint/js typescript-eslint globals lefthook
```

The ESLint packages are optional peers: an app that only wants the language gate or the tsconfig skips them.

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

Run ESLint with `--max-warnings 0`: a warning that passes locally fails CI.

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
| `pre-push` | `tsc --noEmit`, `eslint .`, the language gate on every tracked file, `npm test` (stops at the first failure) |

Install the hooks from `prepare`, skipped when `CI` is set (lefthook 2 installs unconditionally, and a CI checkout
has no use for hooks):

```json
{ "scripts": { "prepare": "node -e \"process.exit(process.env.CI?0:1)\" || lefthook install" } }
```

An app overrides a job by naming it in its own `lefthook.yml` (lefthook merges the files job by job).

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
code spans are skipped. The functions (`findPolishText`, `checkFiles`, `isExempt`, `getCommitMessageText`) are
exported from `@softure-ai/config/language` for an app's own tests.
