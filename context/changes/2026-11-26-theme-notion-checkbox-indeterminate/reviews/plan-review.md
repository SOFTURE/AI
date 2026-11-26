# Plan review: theme-notion-checkbox-indeterminate

Verdict: approve. Styling by `data-state` keeps the fix in CSS, so the look follows Radix's state whether the app
controls the box or not; the indicator carries the same `data-state` as the root, so a named group on it is the
nearest and safest selector. The filled classes mirror the `checked` ones one to one, dark mode included. Both icons
stay `size-3.5`, which the existing test guards. The upstream guard needs the class change listed as a delta (it
replaces the existing checkbox delta's `ours`), and the gallery case change re-baselines only `Checkbox`; other
baselines must not move. The Chromium check proves the issue's acceptance (filled box, minus visible, tick hidden).
