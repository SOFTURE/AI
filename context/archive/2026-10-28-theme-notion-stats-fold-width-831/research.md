---
change_id: theme-notion-stats-fold-width-831
status: done
---

# Research

- `themes/theme-notion/src/notion/Stats.tsx`: `StatsFold` renders `<details>` with a summary (`px-1`, chevron 16 px,
  `gap-1`, `h2`) and a content `div` (`flex flex-col gap-3 pt-2 pb-1 pl-6`). The `pl-6` (24 px) lines the content up
  with the title after the chevron (4 + 16 + 4 = 24 px); there is no right padding.
- The summary's `px-1` is inner padding of the row; the row itself spans the `<details>` width, so content with no
  horizontal padding has the same left and right edges as the row (its hover background).
- `FoldRow` (`src/notion/FoldRow.tsx`) has the same shape (`pr-1 pl-6`); issue #832 handles it in its own thread.
- Consumers inside the package: none render `StatsFold`; the gallery case (`tests/gallery/cases.tsx`) and the README
  example do. Tests pin the content classes in `tests/notion/Stats.test.tsx`.
- The design system artifact bundles `src/index.ts` and has a `StatsFold` preview; it needs the rebuilt bundle.
