# Implementation review: privacy-legal-layout

Diff reviewed against `plan.md` (two phases) and issue #215.

## Plan drift

None. D1–D7 are in `legal-document.tsx`, `legal-footer.tsx`, `ui/index.ts` (new types `LegalDocumentMeta`,
`LegalContentsTitleElement`, `LegalFooterElement`), README §1/§4/§8, CHANGELOG `## 0.1.7` and the version files
(`package.json`, `module.json`, the inline manifest, `package-lock.json`).

## Issue points

| # | Ask | Where |
|---|---|---|
| 1 | Skip the header so the frame owns `<h1>` | `title` optional; `<header>` only with a title, a meta line or an intro |
| 2 | Optional meta line or the app's node | `meta` (union with `version` + `effectiveFrom`); `meta={null}` renders none |
| 3 | History entries without a version | `LegalChange.version` / `.date` optional; summary alone without both |
| 4 | Side-column layout, contents heading element | `body` slot, `contentsTitleAs`, `listChangesInContents` |
| 5 | No `<footer>` inside a footer | `LegalFooter` `as`: `footer`, `div`, `nav` |
| 6 | Separator between links | `separator`, `aria-hidden`, new `separator` slot |

## Correctness

- The nine new tests were run on the old components first: 9 of 9 red. With the change: 96/96 in `modules/privacy`.
- Existing callers: the old props (`title`, `version`, `effectiveFrom`, entries with `version` and `date`) render the
  same text and elements; the only DOM difference is the `body` wrapper (`flex-col gap-4`, the root's own spacing).
- The contents navigation keeps `aria-labelledby` on its title whatever element it is, so its accessible name is
  unchanged (asserted with `contentsTitleAs="p"`).
- A custom meta node goes into a `div`, so block content passed by the app stays valid HTML.
- Change rows key by version, falling back to the index; the list is static, so the fallback is stable.

## Tests

The privacy architecture guard flagged the first draft's `aria-hidden="true"` as inline copy; the attribute is now
the boolean shorthand, and the guard passes.

## Security

No new input reaches the server; the components render only app-provided nodes and module copy.

## Findings

| # | Finding | Severity | Decision |
|---|---|---|---|
| 1 | The `body` wrapper adds one `div` for every existing caller. | Suggestion | Kept: needed for point 4; default classes keep the spacing; recorded in the CHANGELOG. |
| 2 | `as="nav"` puts the optional note inside the navigation. | Suggestion | Kept: the alternative is a second root element; an app that wants the note outside uses `as="div"`. |
| 3 | No `renderChange` callback, which the issue offered as an alternative. | Suggestion | Not needed: a summary-only entry covers the ask, and `summary` is already any node. |

Verdict: approve. Gates: typecheck, lint, test, build.
