# Plan: blog-article-images

Input: change.md, research.md. Complexity: low (one new render helper, a renderer rule, one option,
three gate rules).

## Goal

`renderArticle(markdown, { images })` emits `<img>` for images that follow the policy (site path or
allowed https host, alt, known dimensions; lazy) and the alt text for the rest; `blog({ images })` feeds
the pages and the gate; the gate reports `image-source`, `image-alt` and `image-dimensions`.

**Out of scope:** image hosting, upload or optimisation (`next/image`), figures with captions, images in
FAQ or summary fields, the example app's content.

## Approach

**Chosen:** a shared policy check in `src/render/images.ts`, used by a markdown-it `image` renderer rule
and by a gate rule that lists images with the same parser. Rejected: enabling images through
`validateLink` (it sees only the URL, not alt or dimensions) and a regex scan in the gate (code spans
and fences would give false findings).

**Key decisions:**
| Decision | Choice | Why |
| --- | --- | --- |
| Policy | `ArticleImagePolicy { hosts?: string[]; dimensions(src) → { width, height } \| null }` | research U2, U3 |
| Allowed source | root-relative path that stays on the site, or `https:` to a host in `hosts` (exact or subdomain), no user info | research U2 |
| Check result | `checkArticleImage({ src, alt }, policy)` → `{ ok: true, width, height }` or `{ ok: false, problems }` with `source`, `alt`, `dimensions` (dimensions asked only for an allowed source) | one rule for renderer and gate |
| Emitted markup | `<img src alt width height loading="lazy" decoding="async" class="blog-image">` plus `title` when written | no layout shift, lazy |
| Refused image | escaped alt text, no element | research U5 |
| No policy | every image refused (alt text); the gate reports `image-source` with a hint to set `blog({ images })` | safe default |
| Option | `blog({ images: { hosts, dimensions } })`, zod strict object, `hosts` validated like `siteHosts` | research U4 |
| Gate | `findArticleImages(markdown)` (permissive link validator so `javascript:` images are listed too) → rules `image-source`, `image-alt`, `image-dimensions`, all errors, group `images` | roadmap outcome |
| Links | `LINK` in `text.ts` ignores `![…](…)`; `toProse` drops images | research table |
| CSS | `.blog-body img { max-width: 100%; height: auto; }` | width/height attributes keep the ratio |

## Steps

### Phase 1: renderer and option
1. `src/render/images.ts`: `ArticleImagePolicy`, `ImageDimensions`, `checkArticleImage`,
   `findArticleImages`; export from `src/render/index.ts` and `src/server/index.ts`.
2. `render-article.ts`: option `images`, enable the `image` rule, renderer rule; update the header comment.
3. `src/options.ts`: `images` option; `src/pages/body.ts` passes it; `styles.css`.

### Phase 2: gate
1. `src/quality/text.ts`: `LINK` lookbehind, image removal in `toProse`.
2. `QualitySettings.images` (`resolveQualitySettings(options, config, images)`; `getQualitySettings`
   passes the blog option); `rules/images.ts`; wire into `check-article.ts`; catalog group and rules.
3. Skill template: an "Images" table in `references/rules.md`.

### Phase 3: tests and docs
1. `tests/render-images.test.ts` (allowed, refused per reason, no policy, XSS sources, title, alt
   escaping, image inside a link), `tests/quality/images.test.ts` (findings with lines, code spans and
   fences ignored, an image no longer counts as a link), option parse cases.
2. README: the option, the rendering section, the limitation line.

## Validation

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [x] Phase 1: `src/render/images.ts`, renderer rule, `blog({ images })`, page body, CSS
- [x] Phase 2: link regex, settings, image rules, catalog, skill template
- [x] Phase 3: tests, README
- [x] Gates green; impl review approved
