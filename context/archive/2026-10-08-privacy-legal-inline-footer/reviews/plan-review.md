# Plan review: privacy-legal-inline-footer

Reviewed: plan.md against change.md, issue #241 and `modules/privacy/src/ui/{legal-footer,legal-document}.tsx`,
`modules/privacy/tests/legal-document.test.tsx`, README § 4 and § 8.

Verdict: **ready to implement** (no blocking findings).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `useId()` returns ids with characters such as `«r0»` or `:r0:`. They are valid in `id` and in an `aria-labelledby` token list (no whitespace), but not as a CSS selector without escaping. The contents title id is internal (no anchor links to it), so this is fine; the history anchor, which is a URL fragment, must stay readable, which D2 keeps by making it a prop instead of a generated id. | No change: D2 already splits the two. |
| 2 | Warning | The list form's separator has no default, the inline form's does (`" · "`). Two defaults for one prop could surprise. Without a default the inline form renders `TermsPrivacy policy`, which is never wanted; the list form puts each link in its own `li` and spaces them with `gap`. | Accepted as planned; the JSDoc of `separator` states both defaults. |
| 3 | Suggestion | `note` in the inline form: a `p` root cannot hold the list form's `<p class=note>`. D1 renders a `span`; the test should assert there is exactly one `p` in the output. | Accepted: the `as="p"` test counts `p` elements. |
| 4 | Suggestion | `LegalFooterSlot` is unchanged, so `list` is a dead slot in the inline form. Splitting the props into a discriminated union (list vs inline) would type that, but would break the flat `classNames` an app already passes and gains little: an unused class key is harmless. | No change; README § 8 says `list` applies to the list form only. |
| 5 | Check | Default markup without the new props: `LegalFooter` unchanged; `LegalDocument` changes only the contents title id string. Nothing in the repo references `legal-contents-title` outside the component (`rg` over `modules`, `foundation`, `examples`). | No change. |
| 6 | Check | Lessons: features are still TDD (new tests seen red first). | No change. |

No migration, no API removal, no cross-package impact (waitlist depends on privacy `^0.1.8` and keeps working).
