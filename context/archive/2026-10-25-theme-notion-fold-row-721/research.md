---
change_id: theme-notion-fold-row-721
---

# Research

- Compositions live in `themes/theme-notion/src/notion/` (`Status`, `PageHeader`, `PropertyList`, `PageFrame`), are
  exported by name from `src/index.ts` and tested in `tests/notion/` with `renderToStaticMarkup`.
- `theme.css` scans `./ui` and `./notion` as Tailwind sources (`softureTheme.sources` in `package.json`), so literal
  classes in a new `src/notion/*.tsx` file are generated without the app adding `@source`.
- Every utility in the reference implementation resolves in the theme: `text-ui` / `text-ui-medium` (text styles),
  `min-h-row-height` (size `row-height`), `rounded-md`, `bg-accent`, `border-border`, `text-muted-foreground`,
  `ring-ring`; `duration-120`, `wrap-anywhere` and `group-open/<name>` are Tailwind v4 built-ins.
- `Badge` has `variant="tag"` and `color` with `default` plus the nine palette colours; `ICON_STROKE_WIDTH` is in
  `src/notion/icon-stroke.ts`; `ChevronRight` comes from `lucide-react`, already a dependency.
- `Tone` and `TONE_COLORS` are not on master yet: issue #720 adds them. `TONE_COLORS.default` is `null`, which maps to
  the badge colour `default`, as the reference does with `?? "default"`.
- README "Components" lists the compositions; CHANGELOG lists changes newest first under a version heading.
