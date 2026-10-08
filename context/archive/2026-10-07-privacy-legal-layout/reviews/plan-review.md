# Plan review: privacy-legal-layout

Reviewed `plan.md` against `change.md`, issue #215 and `modules/privacy/src/ui/{legal-document,legal-footer}.tsx`.

| # | Finding | Severity | Decision |
|---|---|---|---|
| 1 | A plain optional `meta` next to required `version`/`effectiveFrom` would force an app without versions to pass a dummy version, and leave a silent precedence rule when both are given. | Warning | Accepted as D2: a discriminated union, mixing is a type error. |
| 2 | A custom meta node rendered inside the existing `<p>` would produce invalid HTML when the app passes block content (its own `<p>`). | Warning | Accepted as D2: the custom node goes into a `div` in the `meta` slot; the default line stays a `<p>`. |
| 3 | Keys by `version` break once versions are optional (duplicate `undefined` keys). | Warning | Accepted as D3: index fallback. |
| 4 | Point 4 cannot be met by `classNames` alone while sections are direct children of `article`: a grid would need a row span equal to the section count for the contents column. | Warning | Accepted as D4: a `body` slot wrapping sections and history. It adds one `div` for existing callers; default classes keep the spacing. Recorded in the CHANGELOG. |
| 5 | `as="p"` from the issue would put a `nav` and a `ul` inside a `<p>`, which the content model forbids. | Suggestion | Accepted as D5: `div` or `nav` instead; the visual "one line" comes from the list classes. |
| 6 | A separator outside the `li` would be invalid inside `ul`. | Suggestion | Accepted as D6: inside the `li`, before the link, `aria-hidden`. |
| 7 | The README intro names the app the components came from. | Suggestion | Accepted as D7: neutral wording. |
| 8 | Each new test must fail on the old components, otherwise it proves nothing. | Warning | In both phases' "done when". |

Verdict: ready to implement.
