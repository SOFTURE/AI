# Research: blog-content-store

Sources read: FIRE_TRACKER (read only, commit `15ec77e`) `src/db/blog.ts`, `src/db/blog-publish.ts`,
`src/lib/blog-article-file.ts`, `src/lib/blog-paths.ts`, `scripts/blog-publikuj.ts`, `drizzle/0050`–`0053`,
`src/db/schema.ts` (blog part), `content/blog/README.md` and the tests `src/db/blog.test.ts`,
`src/db/blog-publish.test.ts`, `src/lib/blog-article-file.test.ts`, `src/db/blog-transport.test.ts`;
SOFTURE `modules/waitlist/` (module layout, migrations, health), `modules/mailing/src/cli/` (bin that
loads the app config), `foundation/db/src/{client,testing}.ts`, `foundation/core/src/module.ts`,
`docs/06-fire-extraction-2.md`.

## What FIRE does

| Part | FIRE file | Behaviour |
| --- | --- | --- |
| Tables | `drizzle/0050`, `0051` (summary), `0052` (term forms), `0053` (pillar) | `blog_articles` (text id PK, unique slug, kind, cluster, title, description, summary, body, status, `current_as_of`, `published_at`, `updated_at`, sources, faq, calculator scenario, term forms, pillar, content sha256) and `blog_slug_history` (old slug PK → article, cascade). CHECKs: kind, status, published has a date. |
| File | `blog-article-file.ts` | `---` YAML `---` body; strict zod object with Polish keys; file name must be `<slug>.md`; pillar needs a cluster; a term needs forms, an article must not have them; reserved slugs refused; content hash over a fixed array of fields (not status, slug, publication date, pillar). |
| Store | `blog.ts` `publishArticle` | Upsert by id in a transaction with `FOR UPDATE`; refuses a slug owned by another article now (`slug-taken`) or in its history (`slug-in-history`); `published_at` = file date, else the first move to published; `updated_at` moves only when the hash of an already published text changes; a slug change records the old slug, returning to an own old slug removes it from history; identical input is `unchanged` with no write. |
| Run | `blog-publish.ts` `runBlogPublish` | Parse all files first, any error → nothing written; duplicate ids refused; one pillar per cluster over the run; all writes in one transaction; dry run = rollback by a thrown sentinel; `--withdraw` forces `withdrawn` for one file; quality gate (BL-5 in FIRE) runs only for files going public. |
| Reads | `blog.ts` | `findArticleBySlug` (any status, for 410), `findArticleStatus`, `findSlugRedirect` (old slug → current slug), `listPublishedArticles` (newest first, ties by slug). |
| CLI | `scripts/blog-publikuj.ts` | `--plik`, `--stdin --nazwa`, `--wszystkie [--katalog]`, `--commit`, `--wycofaj`, `--indexnow`; output `blog|…` lines for FIRE's `deploy.sh`. |

`src/db/blog-transport.ts` does not exist; `blog-transport.test.ts` tests FIRE's `scripts/blog-publikuj.sh`
(the owner's `ssh` into the production container), a deploy concern (roadmap `deploy`), not this package.

## Unknowns answered

**U1. Polish frontmatter keys: alias map or a one-off rename?** A rename. An alias map would make two
spellings of every key valid forever, which defeats "unknown key is an error" (a typo in one spelling
can be a valid key in the other) and doubles the docs. FIRE renames its files once in its adoption
roadmap; the README carries the mapping table (`tytul` → `title`, `aktualne_na` → `current_as_of`,
`typ: artykul|termin` → `kind: article|term`, …) so the rename is mechanical. Recorded as a decision.

**U2. Default folder and how the CLI finds the database.** `softure migrate` and `softure-mail` both load
the app's `softure.config` (default file names or `--config`) and open `config.database.url`; the
example app fills that URL from `DATABASE_URL`. `softure-blog` does the same, so one setting serves
every command. The default folder is a module option, `blog({ contentDir: "content/blog" })`; a path on
the command line wins. Like `softure-mail`, a `runBlogCli({ config, argv })` function serves app
scripts that a bundler packs for a container (FIRE bundles its script with esbuild).

## Fit to SOFTURE contracts

- **Schema:** modules own a Postgres schema; the migrator runs a module's SQL with that schema on the
  search path (waitlist creates `signups`, not `waitlist.signups`). Tables: `blog.articles` and
  `blog.slug_history`; FIRE's `blog_` prefixes go.
- **Constraints FIRE leaves to code** that can be constraints here: id and slug shape (kebab, ≤ 100);
  pillar needs a cluster; term forms only on terms and at least one on a term; sources, FAQ and forms
  are JSON arrays; the hash is 64 hex characters; one live pillar per cluster. FIRE kept the last one in
  code because a partial unique index is not deferrable (moving the pillar inside one transaction
  would fail on the first row). An **exclusion constraint** can be deferred:
  `EXCLUDE USING btree (cluster WITH =) WHERE (is_pillar AND status <> 'withdrawn') DEFERRABLE INITIALLY DEFERRED`.
  Checked on PGlite: moving the pillar in one transaction commits; a second pillar fails with SQLSTATE
  `23P01`. The run-level check stays for a readable message before any write.
- **Clock:** module code takes `ModuleContext` (`db`, `clock`, `config`); FIRE's `new Date()` becomes
  `ctx.clock.now()`, and `created_at` is written from it rather than `now()` in SQL.
- **Personal data:** articles hold editorial content, no user data → manifest `privacy` false, no
  contributor. No routes or mounts yet (BL-4).
- **YAML:** no YAML parser in the tree. Mailing's campaign file is flat `key: value`; articles need
  lists of objects (sources, FAQ). FIRE uses `yaml` (eemeli/yaml, no dependencies, 2.9.1 current); use
  the same.
- **Domain fields (calculator scenario):** an app passes `blog({ fields: z.object({...}) })`; its keys
  join the frontmatter (a clash with a core key is a config error), their parsed value is stored in a
  `fields jsonb` column and enters the content hash. FIRE then passes `scenario` with its own check.
- **Quality gate hook:** FIRE runs `blogGateErrors(text, fileName)` for files going public. BL-6 owns
  the gate; here a `gate` option on the run (and on `runBlogCli`) with no default rules.
- **IndexNow paths:** BL-5. The run returns structured changes (kind, action, statuses, slug, previous
  slug) so BL-5 derives paths without touching the store.

## Risks

- The content hash is the update signal; its field order is a contract. A later field (BL-3, BL-4)
  that enters the hash must be appended only when present, as FIRE did for term forms, so existing
  rows do not all get a new `updated_at`.
- The dry run relies on a rollback of one transaction; the deferred exclusion constraint is then never
  checked, so the run-level pillar check must cover the dry run.
- A single-file publish cannot see other files: the database constraint is what keeps two pillars out.
