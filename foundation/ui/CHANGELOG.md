# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/ui`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`ui@x.y.z`).

## 0.1.10

- `ThemeScript` (`getThemeBootScript`) recolours `theme-color` metas inserted after `DOMContentLoaded` too (Next's
  streamed metadata, React hoisting): a mutation observer applies the current `data-theme` to each one as it
  lands. Before, only the metas present at `DOMContentLoaded` followed an explicit choice on the first load.

## 0.1.9

- `ThemeSwitch` `cookieDomain` also takes a function of the current hostname or `{ apex }` (serializable, for a
  server component); `getThemeCookieDomain(hostname, apex)` gives the apex for the apex and its subdomains and `null`
  for `localhost`, IP addresses and other hosts. `buildThemeCookie` rejects a domain that is not a hostname.
- `ActionForm` without `getErrorMessage` takes an action returning `MessageActionResult` (ready user-facing messages)
  and shows them as they are; with it, codes as before.
- `Button`, `ButtonLink` and the new `ButtonAnchor` (a plain `<a>` with the button look) take `className`.

## 0.1.8

- Described in the GitHub Release `ui@0.1.8`.
