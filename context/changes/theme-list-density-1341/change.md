---
change_id: theme-list-density-1341
title: "theme-kit, theme-notion: list density, compact or roomy (issue #1341)"
status: planned
roadmap_item: null
issue: 1341
branch: claude/project-thread-vz5qtn
created: 2026-11-17
updated: 2026-11-17
---

## Intent

Close [issue #1341](https://github.com/SOFTURE/AI/issues/1341): give themes a list density setting, `compact` (the
current tight rows) or `roomy` (a quiet divider between rows and more vertical room), that an app picks per page,
section or panel with `data-density`, and list components that honour it. An adopting app wrote this by hand (class
constants on its lists, a special case for lists on a tinted card).

## Context

Labels: `enhancement`, `pkg: theme-kit`, `pkg: theme-notion`, `adoption`. `themes/theme-kit` 0.1.9 and
`themes/theme-notion` 0.22.0 are published. Every theme depends on the kit with `^0.1.4`; the kit has added features
in patch versions before (0.1.5, 0.1.7).

## Scope

- Kit: `DENSITIES`, `Density`, `DensityScale`, `DEFAULT_DENSITY`, optional `ThemeDefinition.density`, checked by
  `checkTheme`, written by `buildThemeCss` as `--list-row-y`, `--list-item-y`, `--list-divider-width` on `:root` /
  `[data-density="compact"]` and `[data-density="roomy"]`.
- Theme: `List`, `ListItem`, `ListRow` in `src/notion/List.tsx`, exported; README, gallery, CHANGELOG.
- Releases: theme-kit 0.1.10 (patch, additive), theme-notion 0.23.0 (minor), kit range in theme-notion `^0.1.10`.

## Constraints

- Without `data-density` nothing renders differently (compact is today's look; no existing component changes).
- No raw colours: the divider is the theme's `border`, or `background` on a tinted surface.

## Notes

- Frame skipped: the adopting app's implementation measured the need and named the shape of the fix.

## Decisions (auto)

- Density is CSS variables on an attribute, not React context: it works in server components, cascades to any depth,
  and the nearest `data-density` wins, so a compact panel can sit in a roomy page.
- The kit owns the contract (names, variables, default scale); a theme may set its own scale in its definition.
- No divider-colour variable: a `var(--border)` alias declared on `:root` would freeze the root scheme's value inside a
  `.dark` band (see `sft-bridge.css`). `List surface="tinted"` switches the utility instead.
- Existing components (`ItemGroup`, `Table`, `FoldRow`) are left as they are: they are parity-tested against shadcn or
  have their own sizes; they can adopt the variables later.
- Kit 0.1.10 as a patch keeps every theme's `^0.1.4` range valid, as earlier additive kit versions did.
