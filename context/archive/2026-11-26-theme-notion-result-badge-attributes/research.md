# Research: theme-notion-result-badge-attributes

## Question
Which props can `ResultBadge` pass through to its `Badge`, and in what order, so an app's attributes reach the element
while the theme's own attributes win?

## Findings
- `src/ui/badge.tsx`: `Badge` takes `Omit<React.ComponentProps<"span">, "color"> & VariantProps & { asChild }` and
  renders `data-slot="badge"`, `data-variant`, `data-color` and `className`, then `{...props}` last. So any
  `data-slot`, `data-tone`, `data-color` or `data-spinning` that `ResultBadge` passes reaches the element, and what
  `ResultBadge` passes later in its own JSX wins over what it spread earlier.
- `src/notion/ResultBadge.tsx`: a server-safe function component (no hooks, no "use client"); it sets `data-slot`,
  `data-tone`, `data-color`, `data-spinning` (`undefined` when resting), `title`, `className`, `variant` and `color`.
  A JSX attribute with the value `undefined` still overrides an earlier spread key, so a resting badge drops an app's
  `data-spinning` as well.
- `variant`, `color` and `asChild` are the theme's choice for a result (a filled tag in the tone's colour); letting an
  app pass them would break "one result reads alike in every list". `children`, `title` and `className` already have
  their own props.
- `tests/notion/ResultBadge.test.tsx` renders with `renderToStaticMarkup` and reads the badge's opening tag; the new
  test fits the same pattern.
- Consumers: `List.tsx` only documents `ResultBadge` in a comment; README section "ResultBadge" and the ListEntry
  examples; the Design System artifact shows the component's props.
