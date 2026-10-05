# Implementation review: blog-article-images

Reviewed: the diff of `modules/blog/src/render/` (`images.ts`, `render-article.ts`, `index.ts`),
`src/quality/` (`text.ts`, `settings.ts`, `catalog.ts`, `check-article.ts`, `rules/images.ts`),
`src/options.ts`, `src/pages/body.ts`, `src/server/options.ts`, `styles.css`, the skill's
`references/rules.md`, the README and the tests, against plan.md and plan-review.md. Gates:
`npm run typecheck`, `npm run lint`, `npm test` (3237 passed), `npm run build` green. Verdict:
**approved**; no gaps filed.

## Checks

| Check | Result |
| --- | --- |
| Outcome | `renderArticle({ images })` takes `{ hosts, dimensions }`; an image on a site path or an allowed https host, with alt and known size, renders as `<img class="blog-image">` with `width`, `height`, `loading="lazy"`, `decoding="async"`; any other renders as its alt text (`render-images.test.ts`). The gate reports `image-source`, `image-alt` and `image-dimensions` at the image's file line (`quality/images.test.ts`). `blog({ images })` feeds both (`renderPageBody`, `getQualitySettings`). |
| Security | Sources are checked on the normalised URL that lands in `src`: `//host`, `/\host`, page-relative paths, `http:`, `data:`, user info and a host-suffix trick are refused and tested; alt and title are escaped (tested with `<script>` and quotes); `javascript:` images stay literal text, as links do. `render-xss.test.ts` still forbids `<img>` without a policy and passes. |
| Plan findings | F1 `findArticleImages` parses like the renderer with a permissive validator and the same `renderInlineAsText`: done, tested (refused scheme listed, code ignored, footnote line). F2 a throwing resolver propagates in the renderer and becomes an `image-dimensions` finding in the gate: both tested. F3 normalised `src` for the resolver: README and a test with `%20`. F4 an image is no internal link: tested (`findLinks`, and the model text with an image passes the whole gate). |
| Behaviour change | Without a policy, `![alt](src)` used to render as `!` plus a link to the file; it now renders as the alt text. The one test that pinned "no `<img>`" now pins the alt text. |
| Gate and skill | The catalog gains group `images` with three error rules; `references/rules.md` has an Images table, and the skill sync test passes in both directions. |
| Contract | No change to `src/content/`, `src/db/`, the content hash, the tables or `glossary.ts` (BF-4's lane stays free). `resolveQualitySettings` keeps its two-argument call (the policy defaults to `null`). |
| Language | English code, comments and messages; no new copy (the fallback is the author's alt text). |

## Findings

- R1 (fixed): `typecheck` refused a `readonly string[]` policy passed to `blog({ images })`; the
  option's `hosts` is now a readonly array in the schema.
- R2 (accepted): an unreferenced footnote definition is not rendered, so its images are neither shown
  nor checked; the gate already warns about the definition (`footnote-unused`).
- R3 (accepted): `LINK` now skips a link written right after a `!` in prose (`Wow![see](/x)`), which
  Markdown itself reads as an image; the gate and the page agree.
