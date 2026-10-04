# Example articles

The fixture texts of `@softure-ai/blog` for the example app and its e2e (`e2e/blog.spec.ts`).
`npm run blog:fixtures` publishes them: first the renamed article under its old slug
(`e2e/fixtures/blog-renamed/`), then this folder, so the old slug lands in the slug history.

| File | Covers |
| --- | --- |
| `index-funds.md` | the cluster's pillar: summary, FAQ, sources, a glossary link, contents |
| `bond-basics.md` | a second article in the cluster |
| `emergency-fund.md` | an article without a cluster |
| `saving-rate.md` | a renamed article (old slug `how-much-to-save`, 301) |
| `expense-ratio.md` | a glossary term |
| `retired-term.md` | a withdrawn term (410) |
| `outdated-tax-rules.md` | a withdrawn article (410) |
| `upcoming.md` | a draft (404) |
