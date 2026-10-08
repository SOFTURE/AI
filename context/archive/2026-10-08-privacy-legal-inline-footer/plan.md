# Plan: privacy-legal-inline-footer

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

`LegalFooter` renders inline with `as="p"` / `as="span"`; `LegalDocument` has no fixed ids and takes `as` for its
root; tests, README, CHANGELOG and privacy 0.1.9.

**Out of scope:** the adopting app's removal of its own footer component; other privacy components.

## Findings (the reading behind the plan)

- `legal-footer.tsx`: `as` is `"footer" | "div" | "nav"`; every branch wraps a `ul` in a `nav` named by
  `messages.legal.footer`. Slots: `root`, `list`, `link`, `separator`, `note`. The `root` default is a centred
  flex column with a top border and padding, a block layout that does not fit inside a paragraph.
- `legal-document.tsx`: `CONTENTS_TITLE_ID = "legal-contents-title"` names the contents `nav` through
  `aria-labelledby`. `CHANGES_ID = "legal-changes"` is the history section's anchor (and its title's id
  `legal-changes-title`), linked from the contents with `listChangesInContents`.
- `useId` is already used by `@softure-ai/ui` (`hint.tsx`, `modal.tsx`); React 19 allows it in server components.

## Key decisions

- **D1** `LegalFooterElement` gains `"p" | "span"`, the inline form: `<Root class=root>` holding the links as
  `<a class=link>` with the separator between them as a plain-text `<span class=separator>` (not `aria-hidden`:
  it is the visible punctuation of a sentence). No `nav`, `ul`, `li`, no accessible name of its own. The default
  separator in the inline form is `" · "` (two links with no separator would read as one word); `separator={null}`
  is honoured and renders nothing between links. The `note`, when given, follows the links as an inline
  `<span class=note>` after one more separator (a `<p>` cannot hold a `<p>`). The inline `root` default is
  `sft:m-0 sft:font-sans sft:text-sm sft:text-muted` (a separate default set, so the block look does not leak in);
  `note` default is empty in the inline form. `list` is unused there.
- **D2** `LegalDocument` names the contents with `useId()` (`${id}-contents-title`). The history anchor stays a
  readable URL fragment, so it becomes a prop: `changesId` (default `legal-changes`) for a page with two
  documents. Its title id follows it (`${changesId}-title`).
- **D3** `LegalDocument` takes `as` (`article` default, `div`, `section`) for the root, the issue's minor note.
- **D4** Docs: JSDoc of the new types and props, README § 4 sentences next to the existing `as` and contents ones,
  § 8 unchanged slot lists (no new slot), CHANGELOG `## 0.1.9`, `package.json` + `module.json` 0.1.9 and the
  lockfile.

## Phase 1: inline footer and unique ids (TDD)

- Tests (`modules/privacy/tests/legal-document.test.tsx`):
  - `as="p"` renders one `p` with the links and the default separator as text, no `navigation`, `list` or
    `listitem` role, no `aria-hidden` element; text content `Terms · Privacy policy`.
  - `as="span"` with a custom separator and a note: `Terms | Privacy | Example Ltd.`, note in its own span.
  - `separator={null}` inline renders the links back to back.
  - The list form without `as` is unchanged (navigation, list, aria-hidden separator), already covered.
  - Two `LegalDocument`s on one page: two contents navigations, each named by its own title, distinct
    `aria-labelledby` ids; `changesId` moves the history anchor and its contents link.
  - `as="div"` for `LegalDocument` renders no `article`.
- Code: `legal-footer.tsx`, `legal-document.tsx`; README, CHANGELOG, versions.

Done when: the new tests were seen red, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: inline footer and unique ids

#### Automated
- [x] 1.1 New tests seen red, then green — 1d14197
- [x] 1.2 Gates green (typecheck, lint, test, build) — 1d14197
- [x] 1.3 README, CHANGELOG and version 0.1.9 — 1d14197
