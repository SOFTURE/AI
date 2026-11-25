# Implementation review: theme-notion-fold-row-action-column

Verdict: approve. Matches the plan: with `actions` or `status` the row is a grid, the `<details>` holds only its
summary and shares a row with the column, so the column is exactly the summary's height (measured in Chromium with a
three-line summary on desktop and phone); the opened content is the next grid row, shown by `peer-open` and hidden
when empty. The status renders above the action list; a status alone draws the column. The light sits on the details
and the column together, measured equal on hover of either and when open. Below `md` the column falls under the
summary and the action is 44 px square. Rows without a column keep their markup and classes (parity fixture changed
only by the new gallery case). README and CHANGELOG (`Unreleased`, migration for the app's wrapper and for selectors
of the content) say the same; no version bump. The find-in-page trade-off is documented in the CHANGELOG.
