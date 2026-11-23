# Implementation review: auth-logout-button-slots

Verdict: approved.

- Backwards compatible: with no new props the form and button render as before (a test pins `className` on the
  form, `secondary`/`md`, no full width).
- `classNames.button` goes to `Button`'s `className`, which is appended after its defaults; the defaults live in
  `@layer softure`, so the app's `justify-start px-2` win without selectors. A test pins the order.
- `unstyled` keeps `pending`, `disabled` and `aria-busy`, so the held sign-out still blocks a second click.
- Every new prop is serializable or a React element, so `LogoutButton` (server) forwards them to `LogoutForm`
  (client) safely; the rest spread passes only the declared look props.
