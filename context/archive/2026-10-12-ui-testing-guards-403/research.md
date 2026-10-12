---
change_id: ui-testing-guards-403
---

# Research: ui-testing-guards-403

Sources: `foundation/ui/src/testing/*`, `foundation/ui/src/theme/{tokens,theme-css}.ts`, `foundation/ui/scripts/build-css.mjs`,
`foundation/ui/src/ui/{hint,modal,select}.tsx`, `foundation/ui/tests/architecture.test.ts`,
`foundation/testing/src/guards/*`, Tailwind 4 CLI output for a probe file.

- `@softure-ai/ui/testing` holds plain colour helpers with no test-runner import; `@softure-ai/testing/guards` holds
  `readSourceFiles` (`{ file, source }[]`, sorted), `findLines` (`file:line: text` strings) and the visible-text guards
  built on the TypeScript parser, with `typescript` as an optional peer. ui depends only on `core` and `zod`.
- The package's Tailwind bridge (`buildTailwindTheme`) maps `--sft-color-*` to `--color-*`, `--sft-ease-*` to
  `--ease-*`, text sizes to `--text-*`; `duration-*` tokens are not mapped. The package itself writes
  `sft:duration-(--sft-duration-fast)`, a variable reference.
- Tailwind 4 probe (`tailwindcss` CLI, `@theme { --duration-fast; --color-brand; --ease-snappy }`): `bg-brand`,
  `bg-brand/40`, `fill-/stroke-/border-/outline-/text-brand`, `ease-snappy`, `duration-150`, `duration-(--x)` and
  `bg-(--y)` compile; `duration-fast` compiles to nothing even with `--duration-fast` in `@theme` (no `duration`
  namespace), and `bg-nope` compiles to nothing. A typo is silent, as the issue says.
- The same prefixes carry non-colour utilities: `text-sm` (a `--text-*` size), `text-left`, `text-wrap`;
  `bg-cover`, `bg-linear-to-r`, `bg-no-repeat`; `border`, `border-2`, `border-t`, `border-dashed`; `stroke-2`;
  `fill-none`; `outline-none`, `outline-offset-2`. The guard must know these keyword sets.
- `Hint` opens on `onMouseEnter` and `onFocus` (hint.tsx), never a `title`. `Modal` is the only `createPortal` call
  (modal.tsx:211); `Select` is a custom listbox, no `<select>` anywhere in `src/ui`.
- `Card`, `Modal`, `ActionFormModal` take a `title` prop: a native-tooltip guard must look only at lowercase
  (HTML or SVG) elements.
