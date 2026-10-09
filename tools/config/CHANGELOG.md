# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/config`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.1.0

- First version (#327): one place for the tooling config every SOFTURE app used to copy.
- `@softure-ai/config/eslint`: `createSoftureEslintConfig({ tsconfigRootDir })`, a flat config with the recommended
  JS and type-checked TypeScript rules and the build output ignored. Next.js rules come in through `extends`. Two test
  rules: integration tests import nothing from the app's source (`integration/**`, `@/*` by default), and with
  `fixtures: { module }` the tests take `test` from the app's fixtures instead of `@playwright/test`.
- `@softure-ai/config/tsconfig.json`: the base compiler options of a Next app, targeting ES2023, the target the
  packages are built and tested for.
- `presets/lefthook.yml`: pre-commit (typecheck, ESLint on the staged files, language gate), commit-msg (language
  gate) and pre-push (typecheck, lint, language gate, tests).
- `softure-check-language`: the language gate this repository runs, as a bin: Polish text outside `messages/`
  dictionaries and `pl/` folders fails it. Its functions are exported from `@softure-ai/config/language`.
