---
change_id: theme-notion-steps-738
---

# Research: theme-notion Steps (issue #738)

Read on master e6d049c.

- Compositions live in `themes/theme-notion/src/notion/` (`Stats`, `TabBar`, `Status`, ...), each re-exported by name
  from `src/index.ts` and tested with `renderToStaticMarkup` in `tests/notion/`.
- `softureTheme.sources` lists `./ui` and `./notion`, so literal classes in a new file under `src/notion/` are
  generated in the app's CSS without an app-side `@source`.
- Tokens the look needs exist in `src/tokens.ts`: `primary` / `primary-foreground`, `muted` / `muted-foreground`,
  `green-tag` / `green-tag-foreground`, `red-tag` / `red-tag-foreground`, `blue-bg`, `accent`; text styles `small`;
  `shadow-card` and `rounded-lg` / `rounded-sm` as used by `StatCards` and the badges.
- `Tone` (`src/notion/tones.ts`) has `default`, `success`, `warning`, `danger`, `muted`; it has no "current" meaning,
  so the issue's own state union fits a process better than a `Tone`.
- Built-in copy lives in `src/messages/en.ts` (accessible names only); components default a label prop to it
  (`SidePanel closeLabel`), and the README "Copy" paragraph lists every such prop.
- README "Components" names the compositions; CHANGELOG has `0.2.0` on top and no `Unreleased` section.
