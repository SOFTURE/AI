---
change_id: theme-notion-format-file-size-server-1005
verdict: approved
---

# Implementation review

Reviewed commit 4bc97fd against plan.md and issue #1005.

- Fix: `formatFileSize` and `SIZE_UNITS` live in `themes/theme-notion/src/notion/format-file-size.ts`, which has no
  directive; `Upload.tsx` imports it and no longer exports it; the root re-exports it from the plain module. The built
  `dist/index.js` re-exports `./notion/format-file-size.js`, whose first line is a comment, not `"use client"`.
- Guard: a theme contract case in `tests/repo/themes.test.ts` lists non-component, non-hook exports of every
  `"use client"` module. It failed with exactly `themes/theme-notion/notion/Upload.tsx: formatFileSize` before the
  move (checked) and passes after. `tabsListVariants` is exempted by name with its reason; follow-up issue #1008.
- API: unchanged (`formatFileSize` still on the root, same signature); unit tests now import the plain module.
- Docs: kit README contract rule 4 extended; theme-notion README says the formatter is server-safe; CHANGELOG
  `Unreleased` tells the adopting app it can drop its client wrapper.
- No visual change, so the NOTION · Design System artifact needs no sync.
- Gates: typecheck, ESLint, language gate green (pre-commit); `tests/repo` + theme-notion tests green (1102 in the
  targeted run; deploy-workflows 255/255 after installing openssh-client).

Verdict: approved, no changes.
