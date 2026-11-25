# Plan review: theme-notion-fold-row-action-column

Verdict: approve. The grid with the content as a `peer-open` sibling is the only CSS-only way to make the column as
high as the summary, and it reuses the peer mechanism the row already relies on for its background. The trade-off
(find-in-page on closed rows with actions) is named and confined to rows that opt in with `actions` or `status`. The
acceptance in the issue (three-line summary, status, one action, one hover box) gets a measured Chromium test, not
only class assertions, plus a gallery case under visual regression and axe. Phone behaviour (column under the summary,
44 px controls) is tested at 390 px. Rows without actions keep their markup, so the parity fixture should change only
in the actions case and the new gallery case.
