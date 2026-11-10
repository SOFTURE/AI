# Plan review: theme-fold-row-actions-in-bar

Verdict: approved.

- Scope matches the intent; the row without actions keeps its classes, so no baseline moves.
- Risk: a summary that wraps onto two lines leaves the actions' bar one row high. Accepted: the actions were already
  centred on the first line (0.14.0), and the adopting app's summary fits one line.
- `peer-open` needs the actions after the `<details>` in the DOM; they already are.
