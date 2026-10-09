# Plan review: config-package

Reviewed: `plan.md` against `change.md`, issue #327, `scripts/check-language.mjs`, `tests/repo/packages.test.ts`,
the release rules and the example app's config. Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Critical | Moving the gate into TypeScript breaks the hooks: Node 22 runs `.mjs`, not the package's `.ts` source, and the hooks run before any build. | Fixed in the plan (D2): the repository calls the source through `tsx`, added as a root devDependency (already in the lockfile). |
| F2 | Warning | Two `no-restricted-imports` configs on the same files override each other, so a naive "fixtures rule" plus "black box rule" loses one of them in `integration/**`. | Fixed in the plan (D3): the integration entry carries both; a test asserts both fire there. |
| F3 | Warning | The fixtures module itself must import `test` from `@playwright/test` to extend it. | Fixed in the plan (D3): `fixtures.exempt`. |
| F4 | Suggestion | `extends` in a tsconfig preset with `include` would resolve the globs inside `node_modules`. | Kept out (D4): compiler options only; the README shows the app's `include`. |
| F5 | Suggestion | The example app is the second copy of the tsconfig; moving it onto the preset changes its packed install. | A test pins every preset option to the example app's value instead. |

No migration, no cross-package contract change. The `server-only` shim stays out (optional in the issue).
