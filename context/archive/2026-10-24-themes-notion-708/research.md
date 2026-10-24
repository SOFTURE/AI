# Research: shared theme packages (issue #708)

## Current state (master d4ef63e)

- `@softure-ai/ui` is the `--sft-*` design foundation: own tokens, own primitives, compiled CSS (no Tailwind needed in
  the app). It is not shadcn and has no Notion look. Every other package takes it as a peer.
- Workspaces: `foundation/*`, `modules/*`, `tools/*`, `templates/*`. A package is named `@softure-ai/<folder>`
  (`tests/repo/packages.test.ts`); Vitest includes `{foundation,modules,tools,templates}/*/{src,tests}`; the build
  order, release packing and tag planning read `findWorkspaces`, so a new group needs the workspaces list and the
  Vitest include only.
- The reference app's implementation:
  - `notion-theme.css`: light tokens on `:root`, dark under `prefers-color-scheme`, `@theme inline` mapping them to
    utilities, Tailwind's default palette cleared; a test compares it with a token snapshot (JSON).
  - `globals.css`: Tailwind theme and utilities in layers, `tw-animate-css`, and Tailwind's preflight scoped to
    `[data-slot]` elements so package pages on `--sft-*` keep their own base.
  - `sft-bridge.css`: inside `[data-page-frame]` every `--sft-color/font/radius/shadow` token points at a Notion token.
  - `components/ui/`: 27 shadcn components; fixes over the design system's files: `checkbox`, `select`, `field`,
    `progress` classes, the switch thumb shadow in one constant, the sidebar's controlled-state cookie and its phone
    sheet title as props, a stable skeleton width (`useId` instead of `Math.random`).
  - `components/notion/`: `Status`, `PageHeader`, `PropertyList`, `PageFrame`, `palette.ts`, `icon-stroke.ts`;
    `lib/utils.ts`: `cn` with tailwind-merge extended by the named text styles and shadows; `hooks/use-mobile.ts`
    on `useSyncExternalStore`.
- The design system's own files add nine components the app does not use yet: accordion, avatar, button-group,
  command (cmdk), input-group, item, scroll-area, sonner (needs `next-themes` there), spinner.
- Imports in shadcn files use the `@/` alias; under NodeNext a package needs relative imports with `.js`.
- Tailwind v4 scans sources named by `@source`, resolved relative to the CSS file that holds it, so a package's CSS
  can point Tailwind at its own built components.

## Findings

- A kit with the token contract, the CSS generator, `createCn`, `useIsMobile` and the scoped preflight covers what
  any shadcn-based theme repeats; a theme package is its tokens, its tuned components and its compositions.
- The dark scheme should follow both the system setting and an explicit choice (`.dark` from `next-themes`,
  `data-theme` from `@softure-ai/ui`'s switch), so either theme switch works.
- The few built-in English strings of shadcn (Close, More, Toggle Sidebar, Loading) become one `en` dictionary with
  props to override, as the module standard asks for user-visible text.
