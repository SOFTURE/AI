---
change_id: ui-testing-guards-403
status: open
---

# Plan: ui/testing guards (issue #403)

Input: change.md, research.md. Complexity: small (one new module of pure functions, tests, docs).

## Phase 1: token class guard (TDD)

Files: new `foundation/ui/src/testing/token-classes.ts`, `foundation/ui/src/testing/guard-source.ts`,
`src/testing/index.ts`; test `foundation/ui/tests/testing-guards.test.ts`.

1. Tests first: defined colour passes with variants, important and opacity (`hover:bg-brand/40`, `!text-brand`);
   undefined colour reported as `file:line: class`; keyword utilities pass (`text-sm` with `--text-sm` defined,
   `text-left`, `bg-cover`, `border-2`, `border-t`, `stroke-2`, `fill-none`, `outline-offset-2`); arbitrary values
   skipped; `(--var)` reference checked against every declared variable; `ease-*` against `--ease-*`; named
   `duration-*` reported, numeric passes; `prefix: "sft"` checks only `sft:` classes; comments ignored; `allow`;
   `css` as a list.
2. Implement: read `@theme` blocks (brace matching) for theme variables, all `--name:` declarations for references;
   read string literals per line, split on whitespace, strip variants, `!`, `-`, opacity modifier.

## Phase 2: JSX guards (TDD)

Files: new `foundation/ui/src/testing/jsx-guards.ts`, `index.ts`, `foundation/ui/package.json` (`typescript`
optional peer), test file as above.

1. Tests first: `findNativeTooltips` reports `<span title="…">` and `<svg title>`, not `<Card title>` nor
   `<title>` children; `findHoverOnlyHandlers` reports `onMouseEnter`/`onPointerEnter`/`onMouseOver` without
   `onFocus`; `findRestrictedElements` reports `<select>` and `createPortal(...)` / `ReactDOM.createPortal(...)`
   outside allowed files (path exact, path end or RegExp), checks only the keys given.
2. Implement with `ts.createSourceFile` (TSX), as `@softure-ai/testing/guards` does.

## Phase 3: dogfood and docs

`foundation/ui/tests/architecture.test.ts` runs all four guards over `src/ui` (theme CSS from `buildTailwindTheme`
with the `sft` prefix, the static theme and `buildThemeCss(DEFAULT_THEME)`); `README.md` section; `CHANGELOG.md`
`## Unreleased`.

## Progress

- [ ] Phase 1: token class guard
- [ ] Phase 2: JSX guards
- [ ] Phase 3: dogfood and docs
