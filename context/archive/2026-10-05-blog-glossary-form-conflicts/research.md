# Research: blog-glossary-form-conflicts

Sources: `modules/blog/src/render/glossary.ts`, `src/next/pages.tsx`, `src/db/publish-run.ts`,
`src/db/articles.ts`, `src/cli/run.ts`, `src/quality/` (`check-files.ts`, `link-targets.ts`, `catalog.ts`),
`skill/references/rules.md`, `tests/skill.test.ts`, `tests/check-cli.test.ts`, `tests/publish-run.test.ts`.

## Findings

| # | Question | Answer |
| --- | --- | --- |
| U1 | Which terms does a page link to? | `getBodyOptions` (`src/next/pages.tsx`) builds the glossary with `toGlossary(terms)` from `listArticles(ctx, { kind: "term" })`: every **published** term row. Drafts and withdrawn terms never claim a form. |
| U2 | When do two forms collide? | `createTermMatcher` registers each trimmed form and its capital-first variant; the first term to register a variant keeps it. Variant sets of forms `a` and `b` intersect exactly when `capitalize(a) === capitalize(b)` ("ike"/"Ike" collide on "Ike"; "IKE"/"Ike" do not). So the conflict key is `capitalize(trim(form))`. A term listing one form twice is not a conflict. |
| U3 | What can the publish run see? | The parsed files of the run, and, inside its transaction, every stored row after its own writes. A run of one file can collide with a term stored earlier, so a check over the run's inputs alone misses it; a read of the published terms after the writes, before commit, sees the state the pages will render. |
| U4 | Should stored conflicts the run did not touch refuse it? | No: they are not this run's doing and refusing would block unrelated publishes. They are reported as run warnings; a conflict with at least one term of the run is a problem. |
| U5 | What can `check` see? | The content folder and the checked files, without a database. `runCheck` already merges both into `readPublishedContent` (later files win by slug). Terms' forms need the frontmatter parsed: `parseArticleFile` with the run's parse options; a file that does not parse has its own `file` finding and is skipped here. |
| U6 | Where does a finding belong? | Findings are per file. Each checked published term in a conflict gets one error per conflicting form, naming the other slug(s). Rule id `term-form-conflict`, group `links` (a glossary form is a link source); a catalog rule, so the skill's `rules.md` needs a row (`tests/skill.test.ts`). |
| U7 | Severity override? | The gate's `severity` map can lower or switch off any catalog rule in `check`. The publish run's check is an invariant like "two files have this id" and ignores it; the README says so. |
