---
change_id: config-next-adoption-384
title: "config: install and lint next to Next's ESLint config (issue #384)"
status: archived
roadmap_item: null
issue: 384
branch: claude/project-thread-jnmaxp
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #384](https://github.com/SOFTURE/AI/issues/384) (labels `bug`, `documentation`, `adoption`,
`pkg: config`): `@softure-ai/config@0.1.1` cannot be adopted by a Next.js app as documented.

1. The optional peers (`eslint@^10.11.0`, `@eslint/js@^10.0.1`, `globals@^17.13.0`, `typescript-eslint@^8.71.0`)
   fail `npm install` with `ERESOLVE` next to Next's ESLint 9 stack. Widen them to what the preset really needs.
2. The README's Next example (`extends: [...nextVitals]`) crashes on the first `.mjs` file: the type-checked rules
   run on files Next's parser reads without type information. Make the example work as written.
3. README lines for what an adopting app meets: `noUncheckedIndexedAccess` in the tsconfig base, and how to keep the
   `commit-msg` language job while skipping the file jobs of the lefthook preset.

A reviewer checks `tools/config/tests/eslint.test.ts`, `tools/config/package.json` (peers), the README and the
CHANGELOG `Unreleased` entry.

## Context

config is at 0.1.1 on master. Releases are batched by the coordinator, so this change bumps no version: the
CHANGELOG gets an `## Unreleased` section.

## Constraints

- No rule is added or removed for TypeScript files; an app with no `extends` lints its `.ts` files as before.
- The repository itself keeps ESLint 10 (its own devDependencies do not change).

## Process notes

- Framing: skipped. The issue states each problem with its cause, the measurements and the ask.

## Decisions (auto)

- Peers: `eslint` and `@eslint/js` `^9.22.0 || ^10.0.0` (`defineConfig`/`globalIgnores` exist since 9.22),
  `globals` `>=14.0.0` (only `browser` and `node` are read), `typescript-eslint` `^8.46.0` (as asked; the preset uses
  `configs.recommendedTypeChecked`, `parser` and `projectService`, all stable in 8.x).
- Item 2 is fixed in code, not only documented: the type-checked rules are scoped to TypeScript files, and those
  files get the typescript-eslint parser with `projectService` after `extends`, because type-checked rules cannot run
  under another parser.
- When a config in `extends` already registers the `@typescript-eslint` plugin (Next's does), the preset reuses that
  plugin object: two installed copies of typescript-eslint otherwise fail with "Cannot redefine plugin".
- The Next example is verified by hand against ESLint 9.39 + eslint-config-next 16.4 (recorded in research.md and the
  PR); the repository runs ESLint 10 and cannot install eslint-config-next's plugins, so the automated tests simulate
  Next's parser override instead.
- The issue's measured adoption cost (point 3) becomes README lines, not preset changes: the base keeps
  `noUncheckedIndexedAccess`.
