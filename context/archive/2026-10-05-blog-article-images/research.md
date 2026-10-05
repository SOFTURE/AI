# Research: blog-article-images

Sources read: SOFTURE `modules/blog/src/render/render-article.ts`, `src/pages/body.ts`, `src/options.ts`,
`src/server/options.ts`, `src/quality/` (`check-article.ts`, `catalog.ts`, `settings.ts`, `text.ts`,
`rules/links.ts`), `skill/references/rules.md`, `styles.css`; markdown-it 15.0.2 behaviour (probed);
the BL-3 archive (`context/archive/2026-10-04-blog-markdown-renderer/`). FIRE_TRACKER disables images
too, so it has no baseline to port.

## What happens today

| Input | Output |
| --- | --- |
| `![a chart](/img/x.png)` | `<p>!<a href="/img/x.png">a chart</a></p>`: with the `image` rule disabled, the `!` is text and the rest a link. |
| `![x](javascript:alert(1))` | literal text (the link validator refuses the scheme). |
| The gate | `findLinks` (`text.ts`) matches `[alt](src)` inside `![alt](src)`, so an image counts as a link: `/img/x.png` is an internal link and fails `internal-link-target`. |

So "images are off" today means a stray `!` and a link to the file, and the gate already misreads an
image as a link. Both change here.

## Unknowns answered

**U1. How markdown-it hands an image over.** With the `image` rule on, an image is an inline child
token `image` with `attrs` `src` (normalised: percent-encoded, e.g. a space → `%20`) and `alt` (empty),
`children` (the alt text's inline tokens) and an optional `title`. The default renderer fills `alt`
with `renderInlineAsText(children)` (emphasis dropped, quotes escaped). `validateLink` runs before the
token exists, so `javascript:` and other refused schemes never become images. The parent `inline`
token carries the block's `map` (0-based lines), which gives the gate a line.

**U2. What a safe source check needs.** Two allowed shapes:
- a root-relative path on the site. `//host/x` and `/\host/x` are protocol-relative in browsers (a
  backslash is read as a slash), so the check resolves the source against a placeholder origin with
  `new URL(src, base)` and requires the origin to stay the placeholder;
- an absolute `https:` URL whose host is one the app allows (exact or a subdomain, the rule
  `siteHosts` already uses), without user info.
Relative paths without a leading `/` (`img.png`) depend on the page's URL and are refused; `http:`,
`data:` and every other scheme are refused.

**U3. Where dimensions come from.** `renderArticle` is synchronous and runs per request (ISR), so the
resolver is a synchronous function `dimensions(src) → { width, height } | null` the app supplies (a
manifest built at deploy, a map of known files). Values must be positive integers; anything else
counts as unknown.

**U4. How the gate reaches the policy.** `getQualitySettings(config)` reads the blog options, so a
top-level `blog({ images })` option (next to `blocks` and `siteHosts`) serves both the pages
(`renderPageBody`) and the gate (`QualitySettings.images`). No second copy under `quality`, unlike
`quality.blocks`.

**U5. What the reader sees for a refused image.** The alt text, escaped, as plain text: the reader
keeps the words, no broken image and no link to an unchecked file. The gate refuses such a text before
it is published, so this is a fallback for a turned-off gate or a policy that changed after publishing.

## Risks

- XSS: attribute values go through markdown-it's `escapeHtml`; the source check runs on the
  normalised URL that ends up in `src`. Tests cover `//`, `/\`, `http:`, `data:`, user info and a host
  suffix trick (`cdn.example.com.evil.test`).
- The `LINK` regex in `text.ts` needs a negative lookbehind for `!` and an image pattern removed from
  prose; both keep negated classes only (no lazy patterns, CodeQL).
