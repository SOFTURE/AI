# Plan review: blog-metadata-output-options

Reviewed: plan.md against change.md, issue #240 and the code on master `c323892`. Mode: autonomous (findings decided
by the reviewer, fixes applied to plan.md).

## Findings

### 1. Warning: a required `BlogPageContext` field breaks apps that build it by hand

- **Evidence:** `BlogPageContext` is exported with the views (`/ui`); an app rendering `BlogListingView` with its own
  context object would stop compiling if `clusterAnchorPrefix` were required.
- **Fix:** make it optional (`clusterAnchorPrefix?: string`, default `cluster`), like the optional `ids` and
  `language` on `JsonLdContext`. **Decision:** accepted; plan decision 2 reads "optional".

### 2. Warning: the `og:locale` default changes public output

- **Evidence:** today every text page writes `og:locale` = `en`/`pl`. Open Graph defines `language_TERRITORY`, so the
  bare code is wrong, but it is still a visible change for every app.
- **Fix:** keep the change (the issue calls it a bug for every app), state it first in the CHANGELOG with the
  option that sets another value. **Decision:** accepted.

### 3. Suggestion: fragments must not carry `#` or spaces

- **Evidence:** the ids and the anchor end up in URLs (`…#article`, `/blog#cluster-x`) and in an HTML `id`.
- **Fix:** one pattern for both (`/^[A-Za-z][A-Za-z0-9_-]*$/`), tested with a refused `#article` and `my anchor`.
  **Decision:** accepted, already in plan decisions 1 and 2.

### 4. Suggestion: the feed language follows `bcp47`

- **Evidence:** RSS 2.0 `<language>` takes RFC 1766 / W3C codes (`pl`, `pl-PL`), the same family as `inLanguage`.
- **Decision:** accepted as planned: one source for "the content's language", default unchanged.

### 5. Checked, no finding

- Point 5 of the issue asks for no code; documenting the three behaviours is enough, and spreading the builder's
  result already lets an app replace any field (README example exists since 0.1.8).
- A cluster key `other` colliding with `<prefix>-other` exists today and is untouched by this change.
