# Plan: testing-dom-project

## Approach
`softureVitestConfig({ dom: true })` adds `test.projects` with two inline projects that extend the root config:
`node` excludes `**/*.dom.test.*`; `dom` includes `**/*.dom.test.?(c|m)[jt]s?(x)`, excludes every other script file
(`**/!(*.dom.test).?(c|m)[jt]s?(x)`), runs in happy-dom and adds the DOM setup file. Without `dom` the config is
unchanged.

## Phases
### Phase 1: DOM project, setup file and renderWithUser (TDD)
- Tests first (red): `tests/vitest-preset.test.ts` pins the project shapes for `dom: true` and their absence without
  it; a new Vitest run in a scratch app with `dom: true`: a `menu.dom.test.tsx` opens a small menu with Enter, moves
  with ArrowDown, closes with Escape and asserts focus returns to the trigger (through `renderWithUser`), a second dom
  test proves the previous render was unmounted, and a node test asserts there is no `document`; the run reports both
  projects.
- `src/vitest/preset.ts`: option `dom`, constants `VITEST_DOM_SETUP_FILE`, `DOM_TEST_PATTERN`; `src/vitest/dom-setup.ts`
  (`afterEach(cleanup)`); `src/dom/index.ts` (`renderWithUser`); `package.json` exports, side effects, optional peers,
  devDependencies; root devDependency `@testing-library/user-event`.
- README (a "DOM tests" section, API rows), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run foundation/testing` passes, typecheck, lint and the build pass.

## Decisions (auto)
- File-name split through projects, as the issue proposes, rather than a docblock per file: the app names a file
  `*.dom.test.tsx` and nothing else.
- happy-dom over jsdom: already used and measured in this repository, and lighter.
- The DOM stack stays optional peers, like `vitest` and `@playwright/test`: an app that does not set `dom` installs
  nothing new.
- `renderWithUser` is the only helper: `render` plus `userEvent.setup()`, so a test presses keys without its own
  boilerplate; everything else the app imports from `@testing-library/react` itself.
- An app that defines its own `test.projects` merges with these two; documented under Limitations.
- Ships as a minor of `@softure-ai/testing` (new option and entries, nothing breaks).

## Progress
- [ ] Phase 1: DOM project, setup file and renderWithUser
