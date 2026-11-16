# Plan: theme-notion SidePanel footer (#1312)

## Approach

Add an optional `footer` prop to `SidePanel`; when defined, render it in a non-scrolling strip after
`side-panel-content`, inside the `aside` (so it is hidden with the panel). Document it and bump the package.

## Phases

### Phase 1: footer prop (test-after)

- `themes/theme-notion/src/notion/SidePanel.tsx`: `footer?: ReactNode`; `<div data-slot="side-panel-footer"
  className="flex flex-none border-t border-border p-2">` after the content when `footer !== undefined`.
- `themes/theme-notion/tests/notion/SidePanel.test.tsx`: no strip without `footer`; the strip is the panel's last
  child, outside the content, with the exact classes, holding the footer; hidden while the panel is closed.
- README (`SidePanel` paragraph), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, `npm run typecheck` and `npm run lint` pass.

### Phase 2: version

- `npm run release:version -- theme-notion minor` (0.20.0); the local tag is dropped (the release workflow tags).
- Done when: `themes/theme-notion/package.json` reads 0.20.0 and the CHANGELOG section is `## 0.20.0`.

## Progress

- [x] Phase 1: footer prop
- [x] Phase 2: version
