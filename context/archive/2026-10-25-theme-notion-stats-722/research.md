---
change_id: theme-notion-stats-722
---

# Research: theme-notion stats compositions (issue #722)

Read on master f3c5ba2.

- Compositions live in `themes/theme-notion/src/notion/` (`Status`, `PageHeader`, `PropertyList`, `PageFrame`), each
  re-exported by name from `src/index.ts`, tested with `renderToStaticMarkup` in `tests/notion/`.
- `softureTheme.sources` in `package.json` lists `./ui` and `./notion`, so classes written literally in a new file
  under `src/notion/` are generated in the app's CSS with no app-side `@source`.
- `Badge` (`src/ui/badge.tsx`) has `variant="tag"` and `color` over `default` plus the nine palette colours, which
  is what the reference passes (`TONE_COLORS[tone] ?? "default"`).
- Every token the reference uses exists in `src/tokens.ts`: `row-height` (34px), text styles `ui-medium`,
  `section-label`, `heading-3`, `small`; `shadow-card` is in the theme. `duration-120` / `duration-150` are plain
  Tailwind v4 numeric utilities.
- `ICON_STROKE_WIDTH` is in `src/notion/icon-stroke.ts`; `ChevronRight` comes from `lucide-react` (a dependency).
- `Tone`, `TONE_COLORS`, `TONE_TEXT` are not on master: #720 adds them (the issue's proposal), in flight in a parallel
  thread that merges first. This change imports them and merges master in once #720 lands.
- README "Components" lists the compositions in one paragraph; CHANGELOG has no `Unreleased` section yet.
