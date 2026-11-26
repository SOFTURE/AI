# Plan: theme-notion-checkbox-indeterminate

## Approach
In `src/ui/checkbox.tsx`:
- the root adds `data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary
  data-[state=indeterminate]:text-primary-foreground` and `dark:data-[state=indeterminate]:bg-primary`;
- the indicator gets `group/checkbox-indicator`; it renders `CheckIcon` with
  `group-data-[state=indeterminate]/checkbox-indicator:hidden` and `MinusIcon` with
  `hidden group-data-[state=indeterminate]/checkbox-indicator:block`, both `size-3.5`.
The upstream deltas, README (controls line) and CHANGELOG `## Unreleased` describe it.

## Phases
### Phase 1: indeterminate look (TDD)
- Tests first (red): `tests/ui/checkbox.test.tsx` asserts for `checked="indeterminate"` the root's `data-state`,
  `aria-checked="mixed"`, the filled classes for the indeterminate state, and a minus icon shown only in that state
  (the check icon hidden by the same group); `checked` keeps the check icon shown. Gallery case `Checkbox` gets an
  indeterminate box.
- Code, deltas, parity fixture (`UPDATE_FIXTURES=1`), gallery baselines for the `Checkbox` case, README, CHANGELOG.
- Evidence: in Chromium, the indeterminate box's computed background equals the checked box's, the minus icon is
  visible and the check icon is not.
- Done when: `npx vitest run themes/theme-notion` passes, `visual/gallery.spec.ts` passes, typecheck, lint and build
  pass.

### Phase 2: Design System artifact
- Patch the `Checkbox` code in the artifact's `bundle.js` (and `bundle.css` for missing classes), add an
  indeterminate example to its card, publish, render-check.

## Decisions (auto)
- CSS-driven icon choice through the indicator's own `data-state` (research, option 1): right in controlled and
  uncontrolled use.
- A named group (`/checkbox-indicator`) so an ancestor `group` with its own `data-state` cannot switch the icons.
- Release: a minor (a new look for an existing state, no API change, no dependent range broken).

## Progress
- [x] Phase 1: indeterminate look (TDD) (red first: the 2 new tests in `tests/ui/checkbox.test.tsx` failed (no
  indeterminate classes, no minus icon); after: `npx vitest run themes/theme-notion` 1467 passed (parity fixture
  regenerated with `UPDATE_FIXTURES=1`, only the checkbox slots changed; the #735 drift fixture now names the new tick
  line), `visual/gallery.spec.ts` 152 passed with only `gallery.png` re-baselined (the new indeterminate box);
  Chromium on the gallery, light and dark: the indeterminate box has `data-state="indeterminate"`,
  `aria-checked="mixed"`, the checked box's background and border `rgb(1, 113, 207)`, the minus icon shown (14 px)
  and the tick `display: none`; typecheck, ESLint, the language gate and `npm run build` passed)
- [ ] Phase 2: Design System artifact
