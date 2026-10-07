# Plan: privacy-legal-layout

Input: change.md (research and framing skipped, reasons there). Complexity: small (two components, one phase each).

## Goal

An app renders its legal pages with `LegalDocument` and its legal links with `LegalFooter` and gets exactly its own
markup and text: no forced `<h1>`, no added sentence, history entries as plain sentences, a contents label and side
column, and links inline inside its own site footer.

**Out of scope:** the copy in `privacyMessages`, `LegalSection` (already adoptable), a `renderChange` callback
(a summary-only entry covers the ask, and `summary` is already a free node).

## Findings

- `modules/privacy/src/ui/legal-document.tsx`: `LegalDocument` renders `article > header > (h1, p.meta, intro)`, then
  `nav > (h2, ol)`, the sections, and `section#legal-changes > (h2, ol > li > (span "Version X · date", span summary))`.
  Keys of change rows are `version`.
- `modules/privacy/src/ui/legal-footer.tsx`: `footer > nav[aria-label] > ul > li > a`, then an optional `p.note`.
- `modules/privacy/tests/legal-document.test.tsx` covers both components with happy-dom and Testing Library.
- The adopting app's target: title and "in force since" sentence in its page frame; under it a grid of a contents
  `nav` (label as `<p>`, sticky from `lg`, the history listed last) and a column with the sections and the history
  (a list of sentences); the footer links inline as `<p>` content with " · " between them, inside its `<footer>`.
- README §4 shows the page example and §8 lists the slots; the README intro names the app the components came from,
  which the repository wording rule does not allow.

## Key decisions

- **D1** `title` becomes optional; without it there is no `<h1>`. The `<header>` renders only when it has a title,
  a meta line or an intro. (Issue point 1; the issue's own second suggestion, no extra `header` flag.)
- **D2** the meta line is a discriminated union: `{ version, effectiveFrom }` renders today's line, `{ meta }` renders
  the app's node in the `meta` slot (a `div`, since the node may be block content), and `meta={null}` renders none.
  `version`/`effectiveFrom` and `meta` cannot be mixed (type error), so no precedence rule is needed. (Point 2.)
- **D3** `LegalChange.version` and `.date` become optional. The meta span renders only what is present
  ("Version X · date", "Version X", or the date); with neither, the entry is the summary alone. Row keys fall back
  to the index. (Point 3.)
- **D4** `contentsTitleAs?: "h2" | "h3" | "p"` (default `h2`); the `nav` keeps `aria-labelledby` on it, so its name
  is unchanged. A new `body` slot wraps the sections and the history (default classes keep today's spacing), so a
  grid on `root` can place `contents` and `body` side by side. `listChangesInContents` adds the history as the last
  contents link. (Point 4.)
- **D5** `LegalFooter` gets `as?: "footer" | "div" | "nav"` (default `footer`). With `nav` the root is the navigation
  itself (named by the module's copy), the inner `nav` is not rendered, and the note stays inside it. (Point 5.)
- **D6** `separator?: ReactNode` renders before every link but the first, inside its `li`, `aria-hidden`, in a new
  `separator` slot. A list keeps its semantics; the visible text reads "Terms · Privacy policy". (Point 6.)
- **D7** privacy 0.1.6 → 0.1.7 (`package.json`, `module.json`, the inline manifest in `src/index.ts`), CHANGELOG
  `## 0.1.7`; the README intro drops the app name.

## Phase 1: LegalDocument (TDD)

- Tests: no title → no `h1` and no `header` when there is also no meta and intro; `meta` node replaces the line;
  `meta={null}` renders no line; history entry without version and date renders only the summary, with only a date
  renders the date; `contentsTitleAs="p"` renders a `p` and the nav keeps its name; `listChangesInContents` adds the
  last link to `#legal-changes`; sections sit inside the `body` slot.
- Code: `legal-document.tsx`, `ui/index.ts` (types), README §4/§8.

Done when: the new tests were seen red on the old component and are green now.

## Phase 2: LegalFooter (TDD)

- Tests: `as="div"` renders no `footer` (no `contentinfo` landmark inside a host footer); `as="nav"` renders a single
  named navigation and the note; `separator` gives "Terms · Privacy policy" text with the separator hidden from
  assistive tech and none before the first link.
- Code: `legal-footer.tsx`, README §4/§8, CHANGELOG, version bump.

Done when: new tests seen red first; typecheck, lint, test, build green.

## Progress

- [x] Phase 1: LegalDocument
- [x] Phase 2: LegalFooter
