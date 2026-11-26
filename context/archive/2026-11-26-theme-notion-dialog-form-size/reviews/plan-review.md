# Plan review: theme-notion-dialog-form-size

Verdict: approve. Both additions are opt-in, so every existing dialog renders the same, which the existing size tests
keep proving. The `form` size reuses the `sm` size's height rule, so it grows with its content and scrolls only when
the viewport is short; with `grid` kept, the sticky footer is a normal grid item and needs no flex column. The sticky
offsets are tied to the content's `p-6`: the README must say that an app changing the content padding changes the
footer offsets too. `cn` merges the app's `className` last, so an app can still override either. The Chromium check
covers the issue's acceptance (width per breakpoint, inner scroll, footer at the bottom while scrolling, phone
buttons). The upstream guard needs the new lines listed as deltas, and only the new gallery case may change the
baselines.
