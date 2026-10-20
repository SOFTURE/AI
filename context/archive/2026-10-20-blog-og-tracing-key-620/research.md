---
change_id: blog-og-tracing-key-620
---

# Research: escaped tracing key in the blog README (issue #620)

- `modules/blog/README.md` §8, "Brand fonts": the only place that writes the key, as
  `{ "/blog/[slug]/opengraph-image": ["./assets/fonts/**"] }`.
- `modules/blog/src/next/og-image.tsx` header comment says paths are read on the Node.js runtime but names no tracing
  key; `modules/seo/README.md` says to list the font folder in `outputFileTracingIncludes` without a key. Neither is
  wrong, nothing else in the repo (outside `context/archive/`) writes the key.
- Next.js docs (`outputFileTracingIncludes`) escape dynamic segments in keys: `'/api/login/\\[\\[\\.\\.\\.slug\\]\\]'`.
  The issue measured the escaped key on a Turbopack build (Next 16.3.8): the font lands in the route's `.nft.json` and in
  `.next/standalone`; the unescaped key traces nothing. Webpack builds match keys with picomatch, where `\[` is a
  literal bracket too, so the escaped key works on both builders.
- In a JS string the backslash is doubled: `"/blog/\\[slug\\]/opengraph-image"` (or ``String.raw`/blog/\[slug\]/…` ``).
- Tests: `tests/repo/` checks relative links in every `*.md`; the change adds none.
