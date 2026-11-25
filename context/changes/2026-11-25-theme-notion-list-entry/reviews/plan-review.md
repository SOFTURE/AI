# Plan review: theme-notion-list-entry

Verdict: approve. A new `ListEntry` leaves `ListRow asChild` untouched, so no app breaks. The layout is CSS only
(flex-wrap, `:has()` for the wide control, a stretched `::after` link with the side above it), which keeps both
components server components. The issue's acceptance (badge at the right edge above two controls; the column under the
identity at 390 px) and the owner's three additions (arrow never alone, `data-row-wide`, `isSpinning`) each get a
measured Chromium check or a unit test; the tone → colour map is pinned by a unit test. Gallery, parity fixture and
baselines cover the visual side; the artifact sync is its own phase.
