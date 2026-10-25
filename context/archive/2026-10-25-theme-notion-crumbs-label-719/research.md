# Research: PageHeader breadcrumb label (issue #719)

## Current state (master f3c5ba2)

- `themes/theme-notion/src/notion/PageHeader.tsx`: `PageHeaderProps` has `crumbs?: PageCrumb[]`; when non-empty it
  renders `<Breadcrumb>` with no props.
- `themes/theme-notion/src/ui/breadcrumb.tsx`: `Breadcrumb` sets `aria-label={messages.breadcrumb.label}` and then
  spreads its props, so a passed `aria-label` wins. An explicit `aria-label={undefined}` also overrides the
  default, so the prop must be passed only when it is set.
- README "Copy" lists the copy props of every component; `PageHeader` is not in it.
- Tests: `tests/notion/PageHeader.test.tsx` (`renderToStaticMarkup`), `tests/messages.test.tsx` (copy props).

## Findings

- Name `crumbsLabel` pairs with `crumbs` (the issue offers it first).
- Passing `{...(crumbsLabel === undefined ? {} : { "aria-label": crumbsLabel })}` keeps the default when absent;
  simpler: `aria-label={crumbsLabel ?? notionMessages.en.breadcrumb.label}` duplicates the default. Prefer the
  conditional spread so the default lives only in `Breadcrumb`.
