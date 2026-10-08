# Implementation review: privacy-legal-inline-footer

Reviewed: the branch diff against plan.md (Phase 1, D1–D4) and issue #241.

Verdict: **approve** (no blocking findings).

## Against the plan

- D1: `LegalFooterElement` adds `"p" | "span"`; `LegalFooter` hands those to `InlineLegalFooter`, which renders
  `<Root class=root>` with `<a class=link>` and plain-text `<span class=separator>` between them (no `nav`, `ul`,
  `li`, no `aria-hidden`), the default separator `" · "`, `null` for none, and the note as a `span` after one more
  separator. The inline defaults (`INLINE_CLASSES`) keep only the type and colour on the root
  (`modules/privacy/src/ui/legal-footer.tsx`). Matches.
- D2: `LegalDocument` builds the contents title id from `useId()`; `changesId` (default `legal-changes`) moves the
  history anchor, its title id and its contents link (`modules/privacy/src/ui/legal-document.tsx`). Matches.
- D3: `as` (`article`, `div`, `section`) sets the document root. Matches.
- D4: JSDoc, README § 4 and § 8, CHANGELOG `0.1.9`, `package.json` and `module.json` 0.1.9, lockfile. Matches.
- Tests: seven new cases in `modules/privacy/tests/legal-document.test.tsx`, six seen red before the code (the
  `separator={null}` case also failed, since the list form rendered a list); all 26 green after.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The inline note was guarded by `note === undefined` only, so `note={null}` rendered a trailing separator and an empty `span`. | Fixed: the guard also skips `null`. |
| 2 | Suggestion | `separatorText` is one element reused at several positions. React renders a reused element at each position (each sits under its own `Fragment` key), so this is safe. | No change. |
| 3 | Check | Default markup: `LegalFooter` without `as="p"`/`"span"` takes the old path unchanged; `LegalDocument` changes only the internal contents title id. The repo's single test reference to `#legal-changes` still passes through the default. | No change. |
| 4 | Check | `useId` keeps `LegalDocument` a server component (no state, no effects, no `"use client"`). | No change. |

## Gates

`npm run typecheck`, `npm run lint`, `npm run build` green; `npm test` green (full run before the push).
