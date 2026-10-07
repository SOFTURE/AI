# Plan review: charts-ui-primitive-gaps

Reviewed: `plan.md` (two phases) against `change.md`, issue #197 and the current sources of `@softure-ai/charts`
(`svg/`, `styles.css`, `tests/architecture.test.ts`) and `@softure-ai/ui` (`theme/theme-cookie.ts`,
`ui/theme-switch.tsx`, `ui/action-form.tsx`, `ui/button.tsx`). Mode: autonomous (the thread decides).

Verdict: **ready after the fixes below** (applied to `plan.md` or recorded here as binding for implementation).

## Findings

### F1 (Warning, applied): a function prop cannot reach a client component from the server

**Evidence:** `ThemeSwitch` is `"use client"`; React refuses to serialize a function prop from a server component.
An app that renders the switch from a server layout could not use a function `cookieDomain` at all.

**Fix:** D7 also accepts `{ apex: string }`, resolved on the client with `getThemeCookieDomain`.

### F2 (Warning, applied): the pin ring must read the card, not the page background

**Evidence:** charts sit on cards (`--sft-color-surface`); `--sft-color-background` is the page. A ring in the page
colour would show as a halo on a card in the light scheme (`#f6f7f8` vs `#ffffff`).

**Fix:** `ring: "axis" | "surface"`, reading `--sft-color-surface`.

### F3 (Warning, binding): inline width and opacity must not break `non-scaling-stroke`

**Evidence:** `styles.css` sets `vector-effect: non-scaling-stroke` per class; an inline `style` with only
`strokeWidth` / `strokeOpacity` leaves it in place, but a `className` replacing the class would not.

**Fix:** the app's `className` is appended, never replaces the package class; a test asserts the package class stays.

### F4 (Suggestion, binding): the cookie domain is written into `document.cookie` unchecked

**Evidence:** `buildThemeCookie` interpolates `domain`; a computed value (now from a function) containing `;` would
add cookie attributes.

**Fix:** validate the domain as hostname characters (D7) and test an injection attempt.

### F5 (Suggestion, binding): the new numeric builder must not fork the edge rules

**Evidence:** `timeAxisTicks` holds the edge-margin and alignment rules; a copy in `numberAxisTicks` would drift.

**Fix:** one internal builder over positions and labels; both public builders call it (D4). Existing
`timeAxisTicks` tests stay unchanged and green.

### F6 (Suggestion, applied): token-only rule for new sizes

**Evidence:** `tests/architecture.test.ts` rejects raw colours and unknown `--sft-*` tokens; new pin and flag sizes
need sizes too.

**Fix:** sizes derive from existing tokens (`--sft-chart-dot-size`, `--sft-space-*`, `--sft-text-xs`) with `calc`
factors; no new token is needed.

## Not raised

- Point 5's `className` is marked optional in the issue; it is still delivered (D9), since it costs one prop.
