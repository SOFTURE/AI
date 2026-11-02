---
change_id: ui-app-components-960
---

# Research: app components for themes on @softure-ai/ui (issue #960)

## Findings

1. theme-notion's six components (`src/notion/{InstallBar,UpdatePrompt,LaunchScreen,TopLoadingBar,RouteLoading,
   MiniProgress}.tsx`) are built on its own shadcn primitives (`Alert`, `Button`, radix `Progress`) and lucide icons.
   theme-notion does not depend on `@softure-ai/ui` at all.
2. theme-flat-paint "ships no components of its own": an app renders `@softure-ai/ui`'s components, `sft-bridge.css`
   points ui's `--sft-*` tokens at the Flat Paint roles (shadows are a zero shadow, so ui's `shadow-2` is flat), and
   look maps (`src/look/*.ts`) add only what differs, as `classNames` per slot.
3. `@softure-ai/ui` already has what the components need: `Button` (`primary`), `IconButton` (`lg` = 44 px target),
   `DownloadIcon`, `RefreshIcon`, `CloseIcon`, the slot helpers (`createSlotClassGetter`, `unstyled`). It lacks a
   progress bar, a Share icon and an Add to Home Screen icon.
4. ui's `styles.css` is compiled with the Tailwind CLI from `src/ui/` with the `sft:` prefix; animations need a
   `--animate-*` entry plus keyframes in `scripts/build-css.mjs` (only `sft-spin` exists).
5. pwa's counter (`src/launch/launch-progress.ts`) finds its root by `data-slot`, then `[data-slot="progress"]`,
   `[data-slot="progress-indicator"]` and `[data-slot="<root>-percent"]`; it sets `aria-valuenow`, `aria-valuetext`,
   `data-value`, `data-state="loading"` and the indicator's `transform: translateX(-<100-v>%)`. Any markup with those
   slots works.
6. Flat Paint has the motion pieces for an entrance (`flat-paint-rise-in` keyframes in `page.css`, durations and
   easings as tokens) and the rule that lime (`accent-fill`) is never a thin line in light: a 2 px bar paints with
   `accent`.

## Options

1. **Components in `@softure-ai/ui`, look maps in theme-flat-paint** (the issue's first option, without moving
   theme-notion's): ui gets `ProgressBar`, `MiniProgress`, `LaunchScreen`, `TopLoadingBar`, `RouteLoading`,
   `InstallBar`, `UpdatePrompt` with theme-notion's props plus `classNames` / `unstyled`; Flat Paint adds a look map
   per component. Any future ui-based theme gets them by its bridge, with a map only where it differs. theme-notion
   keeps its own (it is not a ui-based theme), so nothing breaks.
2. **Components in theme-flat-paint**: copies theme-notion's code into a theme that has no components, adding React
   component code, icons and a progress primitive to it; a third theme would copy them again.
3. **Option 1 and rebase theme-notion on the ui ones**: breaking for theme-notion (its look comes from its shadcn
   primitives, `shadow-menu`, its `Progress`), large and not needed for the ask.

Recommendation: option 1.

## Decisions (auto)

- Option 1. theme-notion stays as it is; its components remain the Notion look, the ui ones serve every ui-based theme.
