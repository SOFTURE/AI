# Research: theme-notion-resize-handle

- No resize code in the package: `AsidePanel` only switches between two widths (`standard`, `half`); `SidePanel` is
  `w-[min(24rem,100%)]` (`list`: a fixed column). shadcn's `Resizable` wraps `react-resizable-panels`, a group that owns
  every column's size in percentages; the adopting screen mixes a fixed menu, a list column, a `SidePanel` and a map
  that takes the rest, so a group would replace `SidePanel`'s own layout. A single handle that sets one column's pixel
  width fits better and needs no dependency.
- `SidePanel` `list` and `beside` cover the canvas phone-wide (`max-sm:` classes); a width must not override that, so it
  goes through a CSS variable and an `sm:` class, not an inline `width`.
- Tests: `tests/notion/*.test.tsx` (happy-dom, testing-library); the inventory test needs a README mention and a gallery
  case; the parity fixture and the gallery baselines move with a new case.
- Baselines: Chromium headless shell 1254 cannot be downloaded in the cloud container; 1243 renders the existing 184
  checks identically (a previous change found the same), so baselines are taken there.
