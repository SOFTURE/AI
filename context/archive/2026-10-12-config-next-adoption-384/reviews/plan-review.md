---
change_id: config-next-adoption-384
reviewed: 2026-10-12
verdict: approved
---

# Plan review: config-next-adoption-384

Checked plan.md against change.md, research.md, issue #384 and `tools/config/src/eslint/index.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Scoping the plugin registration to TS files would break a `.js` file that names an `@typescript-eslint` rule in an `eslint-disable` comment. Keep the plugin base object unscoped; scope only the parser and the rule objects. | Taken into Phase 1. |
| 2 | Warning | The parser object after `extends` overrides an app's own `parserOptions` only for the keys it sets (`projectService`, `tsconfigRootDir`); say so in the README so an app knows where to tune them. | Taken into Phase 2. |
| 3 | Check | `.ts` files with no `extends` get the same rules as before: same objects, only a `files` key added. | No change. |
| 4 | Check | The root devDependencies stay on ESLint 10, inside the widened ranges, so the repository's own lint is unchanged. | No change. |

No Critical findings.
