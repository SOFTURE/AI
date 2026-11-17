# Research: theme-notion-live-resize-1326

## Findings

- `src/notion/SidePanel.tsx` sets `style={{ "--side-panel-width": "<n>px" }}` on the `<aside>` and the class
  `sm:data-[sized=true]:w-(--side-panel-width)` reads it on the same element. No other source reads the variable
  (`grep -rn side-panel-width themes/theme-notion/src`).
- `src/notion/ResizeHandle.tsx` calls `change()` on every `pointermove`; `change()` clamps and calls `onChange` when the
  value differs. `onCommit` fires on `pointerup`/`pointercancel` when the width moved.
- `theme.css` is written by theme-kit's `buildThemeStylesheet` (imports, sources, tokens); `softureTheme.imports`
  accepts package names only. `page.css` is copied as it is and the README's setup imports it after `theme.css`.
- Tailwind v4 CLI keeps a top-level `@property` rule (checked by compiling a probe sheet in the package): it emits the
  rule as written and adds its own `@supports` fallback that sets the initial value on every element for browsers
  without `@property`; the inline style on the panel still wins there.
- With `inherits: false` a change of the variable invalidates only the element that holds it; the panel reads it on
  that same element, so the layout is unchanged (the issue measured ~1.3 s → ~30 ms).
- Other inline variables: `--sidebar-width`/`--sidebar-width-icon` (read by descendants of the sidebar wrapper),
  `--form-grid-rows`, `--skeleton-width`, sonner's `--normal-*`: none changes per pointer move.

## Options

1. Register the variable in `page.css` (chosen): no kit change, every app already imports it.
2. Extend theme-kit to emit registrations into `theme.css`: two packages and a kit release for one variable.
3. Drop the variable and write `width` inline: breaks the phone-wide `max-sm:w-full` override and the adopting app's
   existing variable write.
