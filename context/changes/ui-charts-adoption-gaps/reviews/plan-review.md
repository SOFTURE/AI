# Plan review: ui-charts-adoption-gaps

Reviewed: `plan.md` (three phases) against `change.md`, issue #157 and the current sources of `@softure-ai/ui`
(`theme/`, `ui/`, `scripts/build-css.mjs`) and `@softure-ai/charts` (`scale/`, `svg/line-chart.tsx`,
`package.json`). Mode: autonomous (the thread decides).

Verdict: **ready after the fixes below** (all applied to `plan.md` or recorded here as binding for implementation).

## Findings

### F1 (Warning, applied): new utilities can compile to nothing

**Evidence:** `scripts/build-css.mjs` says a utility without a theme value "compiles to nothing, silently"
(`STATIC_THEME`). The plan adds classes from namespaces the package may not define yet (the panel's `37.5rem`
width, `slashed-zero`, grid-area and `content-[attr(...)]` arbitrary values).

**Fix:** item 2.2 checks the compiled `styles.css` for each new selector (a test in `tests/styles.test.ts`), not just
the markup.

### F2 (Warning, applied): the pending reserve must stay out of the accessible name

**Evidence:** a second visible `<span>` with the other label would join `textContent` and the button's name.

**Fix:** the reserve is a `::after` pseudo-element reading a data attribute (the adopting app measured that the
accessibility tree ignores it); the tests assert the button's text is only the visible label.

### F3 (Warning, applied): `StandingPanel` Escape must not close it under a nested modal

**Evidence:** a confirmation `Modal` opened from inside the panel is portalled to `<body>`, outside the panel. A
document-level Escape handler on the panel would close both.

**Fix:** the panel answers only an Escape whose target is inside it and that is not `defaultPrevented` (the modal
prevents its own). Test added to Phase 2.

### F4 (Warning, applied): the cookie values reach an inline script

**Evidence:** `cookieValues` land in the boot script. `toScriptLiteral` escapes them, but a value with `;` or a
space would never match a cookie and silently reset every choice.

**Fix:** validate both values as RFC 6265 cookie octets, non-empty and different (throw a `TypeError`, as for an
invalid cookie name).

### F5 (Suggestion, applied): `schemeScopes` and the defaults layer

**Evidence:** an app whose colours equal the defaults overrides no colour token, so a scope rule built from the
overrides alone would be empty and the section would not change scheme.

**Fix:** already D4 (complete scheme per scope); a test pins it with an empty theme.

### F6 (Suggestion, applied): a peer dependency must still build in the workspace

**Evidence:** `charts` imports `@softure-ai/ui` at runtime (`palette/check-series-palette.ts`). As a peer only, a
fresh workspace install still links it (npm installs peers), but the intent should be explicit.

**Fix:** `@softure-ai/ui` goes to both `peerDependencies` and `devDependencies` of charts; the lockfile is
regenerated with `npm install`, not by hand.

### Checked, no finding

- **D1 keeps core untouched**: only `ActionForm` reads the result, and `Ok<undefined>` is assignable to the widened
  type, so no existing caller breaks.
- **Server safety** (D3, D7): `Card` and `Field` keep no hooks; the new state lives in client components
  (`CopyHint`, `CardDisclosure`), and the props crossing the boundary are strings and plain objects.
- **Defaults unchanged**: every new prop is optional; `submitVariant` stays `primary` (point 8 documented).
