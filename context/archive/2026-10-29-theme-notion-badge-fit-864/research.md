---
change_id: theme-notion-badge-fit-864
status: done
---

# Research

- `themes/theme-notion/src/ui/badge.tsx`: the base is `inline-flex w-fit shrink-0 … overflow-hidden … whitespace-nowrap`
  with no `max-width`, so its width is its content's. Inside a block or flex parent it overflows the parent.
- `themes/theme-notion/src/notion/Status.tsx`: a ghost `Badge` (`gap-1.5 px-0 text-sm font-normal [&>svg]:size-4`) with
  the icon and `children` as a bare text node. A bare text node in a flex container is an anonymous flex item:
  `text-overflow: ellipsis` cannot apply to it, so the text can only be clipped.
- With `max-w-full` on the badge and the word in its own `min-w-0 truncate` span, the span shrinks below its content
  and ends in an ellipsis; the icon must not shrink (`shrink-0`), since an `svg` flex item shrinks by default.
- `max-w-full` resolves against the containing block; a badge whose text fits is unchanged, so the visual baselines and
  the parity fixture's slots other than `badge`/`status` classes stay. The parity fixture records class strings, so it
  is refreshed (`UPDATE_FIXTURES=1`).
- The upstream guard (`tests/upstream.test.ts`) pins `badge.tsx` to shadcn plus deltas: the focus-ring delta already
  rewrites the base string, so `max-w-full` goes into that delta with its reason extended.
- Unit tests render to static markup (no layout). A geometry check needs a browser: the Playwright suite in
  `themes/theme-notion/visual/` opens the built gallery with the real theme CSS; a spec can measure boxes there without
  a screenshot, so no baseline is added.
- The design system artifact bundles `src/index.ts`; `Badge` and `Status` are in its bundle and previews.
