# Plan review: theme-notion-badge-data-color

Verdict: approve. One attribute on one element, test first; placing it before the props spread keeps `Status`
(which passes its own `data-color`) unchanged and lets any caller override it. The upstream delta test and the parity
fixture catch every other place the badge is drawn. `none` setting nothing matches its meaning as the default. No
version bump in the change itself.
