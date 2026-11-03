# Plan: theme-notion formatFileSize on the server (issue #1005)

## Phase 1: the plain module and the guard

Files: `themes/theme-notion/src/notion/format-file-size.ts` (new), `themes/theme-notion/src/notion/Upload.tsx`,
`themes/theme-notion/src/index.ts`, `themes/theme-notion/tests/notion/Upload.test.tsx`, `tests/repo/themes.test.ts`,
`themes/theme-kit/README.md` (contract), `themes/theme-notion/README.md`, `themes/theme-notion/CHANGELOG.md`.

1. Test first: a contract case in `tests/repo/themes.test.ts`, per theme package: list the exports of every
   `"use client"` source file (`export function|const|let|class name`, `export { a, b as c }`, skipping `type`
   entries) whose name is neither PascalCase with a lowercase letter (a component) nor a hook (`use[A-Z]`); expect an
   empty list apart from a named exemption list. It fails on `notion/Upload.tsx: formatFileSize` before the fix.
2. Move `SIZE_UNITS` and `formatFileSize` to `src/notion/format-file-size.ts`; `Upload.tsx` imports it; `index.ts`
   re-exports it from the new module. Point the existing unit tests at the new module.
3. Kit README contract: a client module exports only components and hooks; helpers live in a plain module.
4. theme-notion README: the formatter is safe to call on the server. CHANGELOG `## Unreleased`: the fix, and that the
   adopting app can drop its client wrapper.

## Decisions (auto)

- `tabsListVariants` stays in the upstream client module, exempted by name in the guard with its reason; a follow-up
  issue tracks it. Moving it breaks the upstream pin shape, which is outside this issue.
- Static guard, not a `react-server` runtime check (see #770's research: Node evaluates client modules anyway).
- UPPER_SNAKE constants count as non-component values (a client reference is not the value on the server either).
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1: the plain module and the guard
