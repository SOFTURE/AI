# Implementation review: theme-notion-result-badge-attributes

Verdict: approve. Matches the plan: `ResultBadgeProps` extends the `span` props minus `color`, `children`, `title` and
`className`, the rest is spread on the `Badge` first, and the component's `variant`, `color`, `data-slot`,
`data-tone`, `data-color`, `data-spinning`, `title` and `className` follow, so the theme's attributes win (covered by a
test that passes an app's `data-slot`, `data-tone`, `data-color` and `data-spinning`). The attribute test was red
before the code. `asChild` is not in the `span` props, so an app cannot swap the element. README, CHANGELOG
(`Unreleased`), the JSDoc and the Design System artifact say the same. No findings.
