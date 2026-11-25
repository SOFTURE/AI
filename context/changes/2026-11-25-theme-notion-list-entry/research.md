# Research: theme-notion-list-entry

## Question
How should a list row with an identity, a right column (state above controls) and an optional stretched link be
built in theme-notion, CSS only (server component), and how should a result badge map the tones?

## Findings
- `themes/theme-notion/src/notion/List.tsx`: `ListRow` is a flex row (`LIST_CLASSES.row`) with an `asChild` slot; it
  has no slots of its own. Changing it would break apps that pass a `button` or a link as the row (`asChild`), so a
  new component is safer than new props on `ListRow`.
- `FoldRow.tsx` (#1471) already has the right-column vocabulary: `status` above `actions`, the actions at least the
  touch target below `md` (`max-md:*:min-h-touch-target max-md:*:min-w-touch-target`), the column right-aligned on
  desktop. The same names fit here.
- A stretched link: the title's `<a>` gets `after:absolute after:inset-0` inside a `relative` row, so the whole row is
  the link's hit area; the right column is `relative z-10`, so its controls stay their own targets. The row shows the
  focus ring with `has-[...:focus-visible]` and lights on hover, so it reads as one box.
- Tailwind 4.3 generates `has-[[data-row-wide]]:` and `group-has-[...]/<name>:` variants; `:has()` is supported in
  every browser the theme targets (it already uses `has-` variants elsewhere in the gallery cases).
- `tones.ts`: `TONES` and `TONE_COLORS` map `success`→green, `warning`→orange, `danger`→red, `muted`→gray, `default`
  → none. `Badge variant="tag" color=...` fills a tag in a palette colour (`FoldRow` badges use exactly this). `Status`
  is a ghost badge with a line icon; the result badge is its filled counterpart.
- Spinning icons in the theme: `Document.tsx` and `ui/spinner.tsx` use `animate-spin` on a `LoaderCircle`; the issue
  asks for `motion-safe:animate-spin`, so reduced motion keeps the icon still.
- Links in the theme are plain `<a href>` (`TabBar`); an app with a router link needs to pass its own component, so
  `ListEntry` takes an optional `linkComponent`.
- Consumers to update: `src/index.ts` exports, the gallery cases, the parity fixture, the visual baselines, the
  inventory test, README, CHANGELOG, and the Design System artifact bundle.
