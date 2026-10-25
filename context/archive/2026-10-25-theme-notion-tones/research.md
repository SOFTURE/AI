# Research: theme-notion tones (issue #720)

- `src/notion/palette.ts` exports `PALETTE_COLORS` and `PaletteColor` (nine colours); `tokens.ts` defines each
  colour (`green`, `orange`, `red`, `gray`, ...) and `foreground`, so `text-*`, `bg-*` and `border-l-*` utilities exist
  for them in Tailwind v4.
- `src/notion/Status.tsx` already keeps a literal `TEXT_COLOR` map per palette colour, with the comment that Tailwind
  generates only class names it sees literally. Same pattern fits the tone maps.
- `package.json` `softureTheme.sources` lists `./ui` and `./notion`; the kit writes them as `@source` lines into the
  shipped `theme.css`. A file in `src/notion/` is therefore scanned in the app's build (dist JS keeps string literals).
- `tests/theme-css.test.ts` compiles the theme with the real Tailwind CLI over those sources: the place to prove the
  new class names (e.g. `.bg-red`, `.border-l-orange`) are generated.
- `tests/index.test.ts` checks that no barrel export is undefined.
