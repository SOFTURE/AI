# Implementation review: a SortableHandle that shows on hover (#1353)

Verdict: approve.

- Matches the issue's proposal: `reveal?: "always" | "hover"`, default `"always"`; opacity only, so the tab stop and
  the hit area stay; the row carries `group/sortable-item`, the app needs no class.
- The four cases the issue asks to test are covered: the classes in the component test, the media query and the three
  group states in the generated-CSS test, and all of them measured in a real browser (see plan Progress).
- No existing look changes: the default adds no class with CSS, the group marker generates none, so no gallery
  baseline moves.
- `disabled:opacity-50` from the button stays on a disabled handle; with `reveal="hover"` it is still hidden at rest
  and shows at half opacity on hover, which reads right for a held row.
- README (Sortable section, example), CHANGELOG 0.28.0, `SortableHandleReveal` exported.
