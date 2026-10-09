---
change_id: blog-view-slots-ai-disclosure
status: archived
---

# Plan: view slots, AI disclosure, node disclaimer, OG logo, getBodyOptions on /server (issue #317)

Input: change.md (research and framing skipped, reasons there). Complexity: medium (one package, five points).

## Today (master `e13ae0c`)

- `src/ui/*` views (`BlogLayout`, `BlogListingView`, `BlogArticleView`, `GlossaryIndexView`, `GlossaryTermView`,
  `BlogMethodView`, `BlogFooterNote`, `Breadcrumbs`) take a `BlogPageContext` and write literal `blog-*` classes;
  `BlogLayout` renders `<main className="blog-page"><header className="blog-header">…`.
- `BlogPageContext.disclaimer: string | null`, built by `getPageContext` (`src/next/context.ts`) from
  `blog({ disclaimer })`, rendered as `<p>{disclaimer}</p>`.
- `BlogMethodView` renders five fixed sections from `messages.method`; `whoBody` says the editorial team writes.
- `renderArticleOgImage({ title, label, brand, fonts })` (`src/next/og-image.tsx`) draws the brand name, the title and
  the label in `getOgColors(brand)` (`background`, `foreground`, `accent`); `BlogArticleOgImage` is the route.
  `createOgFontLoader` lives in `src/server/og-fonts.ts` (no Next imports) but is exported only from `/next`.
- `getBodyOptions` and `findArticlesLinkingTermFor` (`src/next/body.ts`) need only `getPageContext`, which is pure but
  lives in `src/next/context.ts` next to `getBlogContext` (imports `@softure-ai/core/next`).
- `tests/architecture.test.ts` collects `blog-*` classes from `className="…"` literals and requires a rule in
  `styles.css` for each.

## Decisions

1. **Slots on the context.** `BlogPageContext` gains optional `classNames?: BlogClassNames`
   (`ClassNames<BlogSlot>` from `@softure-ai/ui`), `unstyled?: boolean` and `layout?: BlogLayoutComponent`. Every
   view already takes the context, so one place carries the look for all five views and the footer note. The
   defaults move to `BLOG_SLOT_CLASSES` (`src/ui/class-names.ts`): slot `page` → `blog-page`, `cardTitle` →
   `blog-card-title`, and so on (the class without `blog-`, camelCase). `createSlotClassGetter` merges them.
2. **`visuallyHidden` survives `unstyled`.** Dropping it would show the hidden last crumb and reading-time label;
   under `unstyled` it stays `blog-visually-hidden` unless `classNames.visuallyHidden` names the app's own class.
3. **Layout.** `BlogLayout` hands `{ context, title, lead, crumbs, meta, children }` to `context.layout` when set;
   the app's component renders its own frame and can use the exported `Breadcrumbs`. Without it the markup is as
   today.
4. **Cards.** `BlogListingView` and `BlogIndexPage` take `renderCard?(card)` with `{ article, href, isLead, context }`;
   its node replaces the package's `<article>` card (the list item and lead slot stay the package's).
5. **Next pages.** Each ready-made page takes an optional `view?: BlogViewOptions`
   (`classNames`, `unstyled`, `layout`, `disclaimer`), merged into the context, so an app wraps the page in one line.
6. **AI disclosure.** `blog({ aiDisclosure: true })` (default `false`) puts the context's `aiDisclosure` on, and the
   method page shows an "ai" section first, from `method.aiTitle` / `method.aiBody`, and swaps `whoBody` for
   `method.whoBodyAi`, which does not claim human editorial control. Default en/pl copy states that texts are
   written with an AI model and published by the site, in the sense of AI Act art. 50(4). No per-article note:
   the issue asks for the method page; an app adds a note through the disclaimer.
7. **Node disclaimer.** `BlogPageContext.disclaimer: ReactNode` (`null` none). A string renders in `<p>` as today;
   any other node renders as given inside the `aside`. The config stays localized strings; a node comes through
   `view.disclaimer` or the app's own context.
8. **OG card.** `RenderArticleOgImageInput` gains `logo?: ReactNode` (drawn before the brand name in the top row) and
   `getOgColors` returns `muted` (`brand.colors.muted`, else the foreground, so the default card does not change),
   which the label line uses. `createBlogArticleOgImage({ logo?, label? })` returns the route; `BlogArticleOgImage`
   is `createBlogArticleOgImage()`. `brandSchema.colors` takes `muted`.
9. **`/server` exports** `createOgFontLoader` (and its types), `getPageContext`, `getBodyOptions` and
   `findArticlesLinkingTermFor`. `getPageContext` moves to `src/server/page-context.ts`, the body helpers to
   `src/server/body-options.ts`; `/next` re-exports them, so its API is unchanged.

## Phase 1: tests first (red on master)

- `tests/ui/view-slots.test.tsx`: markup with `classNames` (app class added), `unstyled` (no `blog-*` except the
  visually hidden one), `layout` (no `blog-page` main; title, lead, crumbs, meta and children reach the component),
  `renderCard`, a node disclaimer with a link, the method page with and without `aiDisclosure`.
- `tests/next/og-image.test.tsx`: `getOgColors` gives `muted` (brand's, else the foreground); a card with a logo
  differs from one without; `createBlogArticleOgImage` exists.
- `tests/server-entry.test.ts`: `/server` exports `createOgFontLoader`, `getBodyOptions`,
  `findArticlesLinkingTermFor`, `getPageContext`, and `getBodyOptions` equals `/next`'s.
- `tests/architecture.test.ts`: also collect the classes of `BLOG_SLOT_CLASSES`.

## Phase 2: implementation

Files: `src/ui/class-names.ts` (new), `src/ui/page-context.ts`, `src/ui/blog-*.tsx`, `src/ui/index.ts`,
`src/server/page-context.ts` (new), `src/server/body-options.ts` (new), `src/server/index.ts`, `src/next/context.ts`,
`src/next/body.ts`, `src/next/pages.tsx`, `src/next/og-image.tsx`, `src/next/index.ts`, `src/options.ts`,
`src/messages/en.ts`, `src/messages/pl.ts`.

## Phase 3: docs and version

README (views: slots, layout, cards, disclaimer, AI disclosure; OG card; `/server` exports), CHANGELOG `0.1.11`,
version in `package.json`, `module.json` if it carries one, `package-lock.json`.

## Gates

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Gates
