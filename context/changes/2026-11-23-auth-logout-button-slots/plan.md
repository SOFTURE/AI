# Plan: auth-logout-button-slots

## Approach

Pass the button's look through `LogoutForm` and `LogoutButton`, with one slot map for the form and the button.

## Decisions (auto)

- Proposal 1 of the issue, not a theme-notion `SidebarAccount`: the problem is that the auth button cannot be
  styled; a theme piece would not fix that and would tie a theme to the auth package. Works for every theme.
- Props, mirroring `Button`: `size`, `fullWidth`, `iconLeft`, `unstyled` (the button keeps structure and the busy
  state, the app styles it), `classNames: { form?, button? }`. `className` stays the form's class (as today) and
  joins `classNames.form`; no deprecation.
- Minor bump of auth (new props, no breaking change) if no dependent range breaks; else patch.

## Phases

1. `LogoutForm` and `LogoutButton` props; tests (the button gets the classes, the form keeps `className`, the
   button is full width, `unstyled` drops the default classes, `LogoutButton` forwards them); README with a sidebar
   row example; CHANGELOG `Unreleased`.

## Acceptance

- `npx vitest run modules/auth` green, including new tests for each prop.
- `npm run typecheck`, `npm run lint` green.
- README shows a sidebar footer where "Log out" is a full-width row aligned with the signed-in line, with no
  descendant selectors.

## Progress

- [ ] Phase 1
