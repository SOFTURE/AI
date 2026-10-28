---
change_id: theme-kit-app-icon-839
verdict: approved
---

# Implementation review

Reviewed the diff from cda7e5f against plan.md.

- Acceptance of #839: `drawAppIcon` returns an `ImageResponse` in the theme's tokens for `app/icon.tsx` and
  `app/apple-icon.tsx`; the README has both files. The lucide problem is solved by drawing icon data instead of
  calling components, after the `next build` proof showed that both a lucide-react element and `react-dom/server`
  fail in a metadata route; the deviation is recorded under Decisions and in the changelog's migration line.
- Generic: only contract roles are read, through `getThemeColor`, which follows alias chains (theme-flat-paint's
  `primary`) and throws on a missing colour or a cycle (bugs, the theme was not checked).
- Safety of the markup: tag and attribute names are checked, values and the colour escaped, so icon data cannot
  break out of the SVG; `{ svg }` markup must be one `<svg>` element. The markup only ever reaches `next/og` as an image.
- Boundaries: the kit root stays free of `next`; `./next` imports the bare `next/og` with an ambient declaration
  (L-002); `next` is an optional peer, `lucide` a dev dependency for the tests. The scratch app type-checked against
  the packed `dist/` types.
- Tests: 17 for the helper and 4 for the colour resolver, exact values, empty and failure cases, a PNG size check.
- Gates: typecheck, lint and the language gate green on every commit; theme-kit suite and the repository tests green
  (the deploy workflow test needs `ssh-keygen`, installed in the container).

Verdict: approved, no changes.
