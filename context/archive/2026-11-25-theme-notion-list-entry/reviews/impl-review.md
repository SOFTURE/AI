# Implementation review: theme-notion-list-entry

Verdict: approve. Matches the plan: `ListEntry` is a new export next to `ListRow` (unchanged), with the slots the
issue names and the owner's three additions. The identity and the side are flex items of one wrapping row; the arrow
lives in the side next to the column, so it cannot wrap alone (measured). The side is `relative z-10` and
`pointer-events: none` with the status and actions groups opted back in, so controls stay their own targets while a
click on a gap or on the arrow reaches the stretched link (measured in Chromium). `data-row-wide` is read with
`:has()`, so the app's existing marker works without a prop; the wide control spans the row from the identity's left
(measured). `ResultBadge` takes its colour from `TONE_COLORS` only, pinned by a unit test for every tone, with a
`motion-safe:animate-spin` icon for a running result. The arrow is wrapped in a slot `span` so the parity fixture
carries no icon classes. README, CHANGELOG (`Unreleased`, with a migration line), gallery cases, parity fixture,
baselines and the Design System artifact say the same. No findings.
