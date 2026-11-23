# Research: auth-logout-button-slots

## Findings

- `modules/auth/src/ui/logout-form.tsx`: client component; `<form className={className}>` around
  `<Button type="submit" variant={variant} pending={…}>`. `modules/auth/src/next/logout-button.tsx`: server component
  that renders `LogoutForm` with `logoutAction` and the configured messages; it forwards `variant`, `className`, `next`.
- `@softure-ai/ui` `Button` (`foundation/ui/src/ui/button.tsx`) already has `size`, `fullWidth`, `iconLeft`,
  `classNames: { root, spinner }`, `className`, `unstyled`. Its defaults sit in `@layer softure`
  (`class-names.ts`), so an app class on the button wins without `!important` and without descendant selectors.
- `LogoutButton` is a server component rendering a client one, so only serializable props can cross: strings,
  booleans and React elements (an icon) do; a render function does not. A slot-class API fits; a `renderButton`
  callback would not.
- Option 2 of the issue (a `SidebarAccount` in theme-notion): theme-notion does not depend on auth and has no
  logout action of its own; a footer piece there would still need the app to pass the logout control in, so the
  styling problem stays in auth. `sidebarMenuButtonVariants` is private to `themes/theme-notion/src/ui/sidebar.tsx`.
- Other users of `LogoutForm`: pwa README (the `beforeSignOut` example), the example app's account page
  (`LogoutButton` with defaults). Both keep working with optional props.
