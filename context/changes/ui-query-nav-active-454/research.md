---
change_id: ui-query-nav-active-454
---

# Research: ui-query-nav-active-454

Sources: `foundation/ui/src/next/query-segmented-nav.tsx`, `foundation/ui/src/ui/query-href.ts`,
`foundation/ui/tests/adoption-gaps-407-next.test.tsx`, `foundation/ui/README.md` (SegmentedNav section),
`node_modules/next/dist/client/components/navigation.d.ts` (next 16.3.8).

- The component calls `useSearchParams().toString()` and `usePathname()` directly and derives `current` from the
  parameter, falling back to `defaultId` for a missing or unknown value.
- next's types declare `useSearchParams(): ReadonlyURLSearchParams` and `usePathname(): string`, but both return
  `null` outside the App Router context (Pages Router before the router is ready, a component rendered without the
  navigation context, e.g. `renderToStaticMarkup` with the real `next/navigation`). The typed rule
  `no-unnecessary-condition` would flag a bare `?? ""`, so the result is widened to `| null` on purpose.
- `getQueryHref({ pathname: "", search: "", param, value: null })` returns `""`; an empty `href` resolves to the
  current address with its query, so the default link would keep the parameter. `?` resolves to the current path
  with no query.
- Tests mock `next/navigation` with `vi.hoisted` state; a `null` case fits the same mock.
