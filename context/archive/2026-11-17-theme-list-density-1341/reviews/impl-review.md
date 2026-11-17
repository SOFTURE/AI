# Implementation review: list density (#1341)

Verdict: approve.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | `ItemGroup`, `Table` and `FoldRow` lists do not follow the density yet. | Accepted as out of scope (change.md, Decisions); the variables let them adopt it later without a kit change. |
| 2 | Suggestion | `ListRow` sets `text-ui`; an app row with its own type style passes it in `className`, which `cn` merges after. | No change: covered by the asChild test (an app class wins). |

Checked against the plan: every phase delivered; compact is the default and no existing component or token changed
(parity fixture: additions only; visual: only the gallery page that gained the new cases changed); the kit stays
`^0.1.4`-compatible for the other themes; values pass `checkTheme` and the unsafe-value guard.
