# Implementation review: blog-content-store

Reviewed: the branch diff (`modules/blog/` with its migration, sources, tests and README, the change
docs, the two blog-followups entries) against plan.md and the plan review. Verdict: **approved**; two
gaps filed as BF-1 and BF-2.

## Plan conformance

| Step | Result |
| --- | --- |
| 1.1 Scaffold | Copied from `templates/package/`; exports `.`, `./server`, `./cli` (no `next`/`ui`: nothing to mount yet); bin `softure-blog`; dependencies core, db, yaml, zod; `module.json` equals the manifest (tested). |
| 1.2 Migration `0001` | `blog.articles` and `blog.slug_history` with every planned CHECK (plan review F3 included), the unique slug, the deferred pillar exclusion and the rollback recipe; each constraint has a refusing test. |
| 1.3 Contract, options, messages | Kinds and statuses closed; `fields` validated by shape and refused when it reuses a module key (plan review F1); `pl`/`en` labels. |
| 1.4 File format | `parseArticleFile` splits the frontmatter by lines (no lazy regex), routes the app's keys to its own schema and every other key to the strict core schema (plan review F1); the hash appends forms and fields only when present, fields with sorted keys. |
| 2.1 Store | `publishArticle` and the reads port FIRE's `blog.ts` with the clock from the context; all FIRE cases plus kind and cluster filters. |
| 2.2 Run | Parse, gate, duplicate ids and pillars before any write; one transaction; dry run by sentinel; `23P01` at commit reported as a problem (plan review F2), tested on PGlite and by hand on Postgres 16. |
| 3.1 CLI | `softure-blog publish [path…] [--commit] [--withdraw] [--config]`; unknown options and `--withdraw` with other than one path refused before the config is loaded; a folder given to `--withdraw` refused before the database is opened (plan review F4, narrowed: telling a folder from a file needs no config, but the check runs after it loads). |
| 3.2 README | Twelve sections, the file format, rules, command output, `runBlogCli` for bundled apps, the FIRE key mapping and the adoption note on the hash. |

## Checks

| Check | Result |
| --- | --- |
| Correctness | 89 package tests: 21 file format, 32 store and constraints, 14 run, 13 CLI and bin, 8 module, 1 messages. Manual: `softure migrate` and `softure-blog publish` (dry run, commit, unchanged, draft to published, unknown option, a second pillar refused at commit) against Postgres 16. |
| Baseline | FIRE's `blog.test.ts`, `blog-publish.test.ts` and `blog-article-file.test.ts` cases pass in the package, except IndexNow (BL-5), the quality rules (BL-6; the hook is tested) and the `--stdin`/`ssh` transport (deploy roadmap). No FIRE literal in `src/`. |
| Data | Every row invariant is a constraint; only "slug not in another article's history" stays in code, under the row lock. |
| Errors | Expected refusals are values (`ok: false`, `status: "refused"`); driver errors propagate; the CLI prints the driver message without the URL. |
| Security | SQL through drizzle and parameters only; no secrets; the command reads files only under the paths it is given. |
| Language | English only; Polish only in `src/messages/pl.ts`; `npm run lint:language` green. |
| Gates | `npm run typecheck`, `npm run lint`, `npm test` (2796 passed), `npm run build` green. |

## Findings

- R1 (gap, filed as **BF-1**): `src/cli/command.ts` is the third copy of the config loader of
  `softure migrate` and `softure-mail`. Kept as a copy here so this change does not touch two other
  packages.
- R2 (gap, filed as **BF-2**): two runs racing to give one new slug to two articles: the loser fails
  with the driver's unique violation, not `blog.slug_taken`. README §12 states it.
- R3 (accepted): `listArticles` returns whole rows with bodies; the listing page (BL-4) may want a
  narrower select. BL-4 owns the page and its query shape.
