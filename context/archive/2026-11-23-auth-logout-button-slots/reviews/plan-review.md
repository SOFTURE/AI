# Plan review: auth-logout-button-slots

Verdict: approved.

- The slot API crosses the server/client boundary (strings, booleans, an icon element); a render callback would not.
- Backwards compatible: `className` keeps its target, so the adopting app's workaround keeps working until it moves
  to `classNames.button`.
- `unstyled` is worth having: with a theme's own row class the button's default height and padding would otherwise
  have to be undone one by one.
- Keep the busy state (`pending`, `aria-busy`, disabled) under `unstyled`; a test should pin it.
