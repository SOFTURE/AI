---
change_id: theme-kit-text-size-adjust-1056
status: planned
---

# Plan: text-size-adjust on html (issue #1056)

Input: change.md, research.md. Complexity: small (one stylesheet rule, its test, docs).

## Phase 1: the html rule (TDD)

Files: `themes/theme-kit/src/base.css`, `themes/theme-kit/tests/stylesheets.test.ts`.

- Test first: the selector list is `*, ::before, ::after, ::backdrop`, `html`, `body`; the sheet carries
  `html {\n    -webkit-text-size-adjust: 100%;\n    text-size-adjust: 100%;\n  }`.
- `base.css`: the `html` rule inside `@layer base`, before `body`; the header comment says why.

## Phase 2: docs

`themes/theme-kit/README.md` (the `base.css` row), `themes/theme-kit/CHANGELOG.md` `## Unreleased` with the
migration (an app drops its own rule, or keeps it: same value).

## Decisions (auto)

- Option 1 from research: the kit's shared base, so every theme gets it.
- Both the prefixed and the standard property: Safari reads the prefixed one, others the standard.
- No version bump: the coordinator releases. No theme-notion source change, so the NOTION · Design System artifact
  needs no update (the rule changes nothing on a desktop page).

## Progress

- [ ] Phase 1: the html rule
- [ ] Phase 2: README and CHANGELOG
- [ ] Implementation review
