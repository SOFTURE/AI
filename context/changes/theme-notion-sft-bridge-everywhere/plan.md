# Plan: theme-notion-sft-bridge-everywhere

## Approach

Option A of the research: `sft-bridge.css` declares the aliases unlayered on `:root, .light, .dark, [data-theme],
[data-page-frame]`; the body rule for `PageFrame` stays in `@layer base`. A second visual page (`visual/bridge`) is built
like an app that uses ui and the theme together (ui's `styles.css` first, the scoped preflight, the theme, the bridge)
and shows ui components, the chat primitives of #1259 included, outside a `PageFrame`.

## Phases

1. Bridge and unit test (test-first): `tests/sft-bridge.test.ts` asserts the selector list and the unlayered block
   (fails before the change), then the CSS change.
2. Bridge page and browser checks: `visual/bridge-page.ts` builds the page; `visual/bridge.spec.ts` checks computed
   `--sft-*` values outside a frame, in a frame and in a nested `.dark` band, takes screenshots of the ui chat
   primitives in both schemes and runs axe. Waits for #1259 on master for the chat components.
3. Docs: README (stylesheet comment, the bridge paragraph, Testing layer 6), CHANGELOG `## Unreleased`.
4. NOTION · Design System artifact: add the bridge rule to its `bundle.css` if the artifact carries the bridge;
   otherwise record that nothing visual changed there.

Done when: `npm run typecheck`, `npm run lint`, the theme's tests, the repository tests and the theme's visual suite
pass.

## Progress

- [ ] 1 Bridge and unit test
- [ ] 2 Bridge page and browser checks
- [ ] 3 Docs
- [ ] 4 Design System artifact

## Decisions (auto)

- Option A over a documented `PageFrame` rule: the issue lets the thread choose; A matches theme-flat-paint and needs
  nothing from apps.
- Unlayered aliases: the only way an alias on `:root` beats ui's `@layer softure` defaults on the same element.
