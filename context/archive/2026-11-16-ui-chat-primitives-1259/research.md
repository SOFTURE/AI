# Research: ui chat primitives (issue #1259)

Base: `master` at `8dd9591`. The question-level research is the concept check
`context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md` (answers 3, 4, 5 and 6). This file adds what the
implementation needs from `foundation/ui`.

## How ui builds a component today

- Client components carry `"use client"` and live in `src/ui/<name>.tsx`, re-exported from `src/ui/index.ts`.
- Slots: `createSlotClassGetter({ defaults, classNames, unstyled })` (`class-names.ts`); each component exports its
  `<Name>Slot` union and `<Name>Props`. State goes to `data-*` attributes (`Button`'s `data-variant`, `Checklist`'s
  `data-done`) so themes can style it from a class map.
- Copy: one group per component family in `src/messages/en.ts`; `getCopy(group, useUiCopyProps(group, props))`
  merges the provider's and the component's overrides (`copy.ts`, `locale.tsx`). `formatMessage` fills `{name}`.
- CSS: `scripts/build-css.mjs` compiles the `sft:` classes found in `src/ui/` (Tailwind 4 CLI, `@layer softure`) and
  fails over 20 kB gzip. Tokens: `foreground`, `muted`, `surface`, `surface-raised`, `border`, `accent`,
  `accent-fill`, `on-accent`, `danger`, `focus`, radii `control` / `card`.
- Reusable pieces: `Button` (`pending`, variants), `IconButton`, `EmptyState` (`card.tsx`), `FormError` (`role="alert"`),
  the private `Spinner` in `button.tsx`, `ChevronDownIcon`, `RefreshIcon`.

## Tests

- Vitest with `// @vitest-environment happy-dom` and Testing Library (root devDependencies).
- `axe-core` 4.14.0 is in the lockfile (through theme-notion's `@axe-core/playwright`) but not declared by ui.
  Measured: `axe.run(container)` works under happy-dom (rules needing layout, `color-contrast`, are switched off).
  ui declares it as a devDependency so the import is not phantom.

## Accessibility decisions carried from #1248

- `role="log"` is implicitly `aria-live="polite"`; streamed tokens would flood a screen reader. The log keeps the
  role and `aria-busy` while streaming but sets `aria-live="off"`, and a separate polite, atomic status region reads
  the finished message once (`announcement` text, filled only when streaming ends).
- Enter sends, Shift+Enter adds a line, an IME composition never sends; Send becomes Stop while `submitted` or
  `streaming`; Retry on `error`. Focus stays in the textarea.
- useChat's `status` values (`ready`, `submitted`, `streaming`, `error`) are mirrored as a plain string union, not
  imported.

## Risks

- CSS budget: a few dozen new classes; the build prints the size.
- Theme threads (#1260, #1261) depend on slot names; they are fixed in the plan and announced at merge.
