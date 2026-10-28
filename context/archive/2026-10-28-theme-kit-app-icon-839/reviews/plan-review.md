---
change_id: theme-kit-app-icon-839
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (cda7e5f).

- Acceptance of #839: a helper returning an `ImageResponse` in the theme's tokens, the lucide hook issue handled
  (`renderToStaticMarkup` before `next/og`), a README section on `icon.tsx` / `apple-icon.tsx`. Covered by phases 2-3.
- Generic: only contract roles are read; alias resolution covers theme-flat-paint. A theme without `secondary` or
  `accent` cannot exist (the contract requires them).
- Boundaries: the kit root gains only a pure function; `next` enters through `./next` with a bare `next/og` import
  and an ambient declaration (L-002). The package-shape test must accept a new subpath; checked in phase 2 by `npm test`.
- L-002 asks for a `next build` proof: the example app does not consume themes, so phase 2 proves it with a scratch
  Next app building `app/icon.tsx` against the packed kit; recorded in Progress.
- Exceptions only for bugs (unknown colour, alias cycle, a non-SVG icon), as the conventions say.

Verdict: approved, no changes.
