# Plan: theme-notion-result-badge-attributes

## Approach
`ResultBadgeProps` extends `Omit<React.ComponentProps<"span">, "color" | "children" | "title" | "className">`; the
component spreads the rest on the `Badge` first, then sets `variant`, `color`, `data-slot`, `data-tone`, `data-color`,
`data-spinning`, `title` and `className`, so the theme's attributes always win.

## Phases
### Phase 1: pass the app's attributes through (TDD)
- Tests first (red) in `tests/notion/ResultBadge.test.tsx`: `data-read-status="ok"` and `id` reach
  `[data-slot=result-badge]`; an app's `data-tone="danger"`, `data-slot`, `data-color` and `data-spinning` on a resting
  success badge leave `data-slot="result-badge"`, `data-tone="success"`, `data-color="green"` and no `data-spinning`.
- `src/notion/ResultBadge.tsx`; JSDoc; README "ResultBadge"; CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion/tests/notion/ResultBadge.test.tsx` passes, typecheck and lint pass.

### Phase 2: Design System artifact
- Note the pass-through on the `ResultBadge` card of the "NOTION · Design System" artifact and publish.

## Decisions (auto)
- Pass through every remaining `span` prop, not only `data-*` and `id`: ARIA attributes and handlers are as legitimate
  on a badge, and the type stays the `Badge`'s own minus what the theme owns.
- `variant`, `color` and `asChild` are not accepted: the result's look is the theme's.
- Released as a patch or minor with the next theme-notion release (additive props, no dependent range broken).

## Progress
- [x] Phase 1: pass the app's attributes through (the attribute test red before the code: 1 failed, 7 passed; after:
  `npx vitest run themes/theme-notion tests/repo` 2367 tests passed, `tests/repo/deploy-workflows.test.ts` after
  installing the container's missing `ssh-keygen`; typecheck, ESLint and the language gate passed in the pre-commit
  hook) — d2be102
- [x] Phase 2: Design System artifact (v89-90: `ResultBadge` in `bundle.js` copies the remaining props onto the badge
  before its own attributes, checked in Chromium: `data-read-status="ok"` and `id` reach the badge, an app's
  `data-tone`, `data-slot` and `data-spinning` do not; `ResultBadgeProps` in `index.d.ts` extends the `span` props;
  the ResultBadge card says so)
