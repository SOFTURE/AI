# Plan: loading-script-on-client-render

## Approach
Render the counter's `<script>` through a client component that draws it only from React's server snapshot.

## Phases
### Phase 1: StreamedScript (TDD)
- Tests first in `themes/theme-notion/tests/notion/LaunchScreen.test.tsx`, `TopLoadingBar.test.tsx` and
  `foundation/ui/tests/app-components-960.test.tsx`: a client render draws no script and logs no error; the server
  HTML still holds the script; hydrating that HTML logs no error.
- `StreamedScript` in both packages; `LaunchScreen` and `TopLoadingBar` use it. Changelogs and patch versions.
- Done when: the tests fail without the change and pass with it; typecheck, lint and the packages' tests pass.

## Progress
- [x] Phase 1: StreamedScript (without the source change 4 of 32 tests fail; with it 32 of 32 pass:
  `npx vitest run themes/theme-notion/tests/notion/LaunchScreen.test.tsx themes/theme-notion/tests/notion/TopLoadingBar.test.tsx foundation/ui/tests/app-components-960.test.tsx`).

## Decisions (auto)
- See `change.md`.
