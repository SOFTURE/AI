# Implementation review: theme-notion-side-layout-inline

Verdict: approve. The diff matches the plan: an optional `sideLayout` prop on `ListEntry` and `FoldRow` (type
`SideLayout`, exported), `stack` by default, with the column marked `data-side-layout`; JSDoc, README, CHANGELOG
`Unreleased`, two gallery cases and the parity fixture. Checked cases: the default renders the same layout as before
(the existing unit and fit tests pass unchanged, and no existing gallery baseline moved: only `gallery.png`, which shows
the two new cases, was re-baselined); `inline` puts the badge before the control with their middles level at 1440 and
390 px (new fit tests, red first); a menu stays after the inline control on the same line; a `data-row-wide` control
keeps the column direction (`has-[[data-row-wide]]:flex-col`, 4 px gap as before); on a phone the `ListEntry` line
wraps under the identity, right-aligned, with 44 px controls; `FoldRow` with `align="start"` maps to the cross axis
(`md:items-start`). `FoldRow` imports only the type from `List.tsx`, so no runtime cycle. The artifact's bundle was
patched with the same class strings and render-checked in Chromium (badge right edge 8 px before the control, middles
equal, at 1280 and 390 px, no console error).
