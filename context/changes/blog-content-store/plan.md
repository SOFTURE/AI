# Plan: blog-content-store

Input: change.md, research.md. Complexity: medium (a new module with one migration, a file parser, a
transactional store and a bin; each has a pattern in the tree or in FIRE).

## Goal

`@softure-ai/blog` exists in `modules/blog/`: an app enables `blog()`, runs `softure migrate`, and
`softure-blog publish [path…] [--commit]` brings `blog.articles` and `blog.slug_history` to the state
of its Markdown files. FIRE's store, run and file cases pass in the package on PGlite, with English
keys and no FIRE literal in `src/`.

**Out of scope:** rendering (BL-3), pages, routes, 301/410 handlers and the example app (BL-4), RSS,
sitemap and IndexNow (BL-5), quality rules (BL-6), FIRE's `ssh` transport and `--stdin` (deploy
roadmap), npm release (BL-8).

## Approach

**Starting point:** nothing in SOFTURE; FIRE's store is spread over `src/db/blog*.ts`,
`src/lib/blog-article-file.ts` and a script with Polish output for its `deploy.sh`.

**Chosen:** a module copied from `templates/package/`, with FIRE's logic ported file by file into
`src/content/` (pure parsing and hashing), `src/db/` (schema, store, publish run) and `src/cli/`
(`softure-blog`, modelled on `softure-mail`). The run returns structured data; only the CLI formats lines.
Rejected: keeping FIRE's `blog|…` line protocol (a deploy script contract; English, human lines plus
exit codes serve both); a Polish key alias map (research U1); the pillar rule only in code (research:
a deferrable exclusion constraint holds it).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Frontmatter keys | `id, slug, kind, cluster, pillar, title, description, summary, status, current_as_of, published_at, sources[{name,url}], faq[{question,answer}], forms` | English, snake_case like FIRE's file keys | research U1 |
| Kind values | `article`, `term` | English; FIRE renames once | research U1 |
| Database | the app's `softure.config` (`database.url`), `--config` to choose the file | same as `softure migrate` and `softure-mail` | research U2 |
| Default folder | `blog({ contentDir })`, default `content/blog`; CLI paths win | one place for the app's choice | research U2 |
| Domain fields | `blog({ fields: z.object(…) })`, keys merged into the strict frontmatter, stored in `fields jsonb`, in the hash when non-empty | FIRE's scenario stays in FIRE | research |
| Reserved slugs | `blog({ reservedSlugs })`, default `[]`; BL-4 adds its own static pages | FIRE `blog-paths.ts` without FIRE literals | research |
| One pillar per cluster | run check (message) + `EXCLUDE … DEFERRABLE INITIALLY DEFERRED` | a constraint that a move inside one transaction does not trip | research |
| Gate hook | `gate?: (file, article) => readonly string[]`, called only for files going public; none by default | BL-6 owns the rules | roadmap |
| YAML | `yaml` ^2.9.1 dependency | FIRE's parser; lists of objects | research |
| Time | `ctx.clock.now()` for `published_at`, `updated_at`, `created_at`, `changed_at` | module contract | research |
| Results | store returns `{ ok: true, action, before, after, previousSlug }` or `{ ok: false, error: "blog.slug_taken" | "blog.slug_in_history", otherArticleId }` | expected failures as values | AGENTS.md |

**Critical details:**
- The content hash is a SHA-256 of a JSON array in fixed order: kind, cluster, title, description,
  summary, body, current_as_of, sources as `[name, url]`, FAQ as `[question, answer]`, then term forms
  only when non-empty, then fields only when non-empty. Status, slug, publication date and pillar are
  outside it. New fields are appended only when present (research, Risks).
- `published_at`: the file's date (a day is midnight UTC; a datetime needs an offset); otherwise kept
  from the row; otherwise the clock when the status is `published`. `updated_at` moves only when the
  hash of a row that already has `published_at` changes.
- `publishArticle` locks the row by id (`FOR UPDATE`), refuses a slug another article owns now or in
  its history, records the old slug on a change and deletes the new slug from the own history.
- `runBlogPublish` parses every file before the first write; any problem (parse, duplicate id, two
  pillars, gate) writes nothing. All writes go through one transaction; a dry run rolls it back with a
  sentinel error; a refused slug rolls everything back. A `23P01` on commit (a pillar clash with a row
  outside the run) is reported as a problem, not thrown.

## Phase 1: Module, migration and file format

1. Copy `templates/package/` to `modules/blog/`; name `@softure-ai/blog`, bin `softure-blog`, exports
   `.`, `./server`, `./cli` (no `next`/`ui` yet: nothing to mount); dependencies core, db, yaml, zod;
   peer drizzle-orm; `module.json` (`id: blog`, `dbSchema: blog`, `tables: [articles, slug_history]`,
   privacy false).
2. `migrations/0001_create_articles.sql`: `articles` with CHECKs (id and slug kebab ≤ 100, kind,
   status, title 1–200, description 1–320, summary 1–600 or NULL, body non-empty, published has a date,
   `updated_at` only with `published_at`, pillar needs a cluster, forms by kind, JSON arrays, hash
   shape), unique slug, the deferrable pillar exclusion; `slug_history` (old slug PK, kebab; FK with
   cascade; index by article). Rollback recipe in the header.
3. `src/db/schema.ts` (drizzle view), `src/contract.ts` (kinds, statuses, row and input types, error
   codes), `src/options.ts` (zod options: `contentDir`, `reservedSlugs`, `fields`, with a check that
   `fields` keys do not clash with core keys), `src/messages/` (kind and status labels, `pl`/`en`),
   `src/index.ts` (`blog` factory with migrations and health).
4. `src/content/article-file.ts`: `parseArticleFile(text, fileName, options)` and
   `computeContentHash(content)`; ported cases plus unknown key, a `fields` plugin key and a clash.

### Phase 1 checks
- Automated: `tests/article-file.test.ts`, `tests/module.test.ts` (module.json = manifest, versions,
  option defaults and errors, health), `tests/messages.test.ts`; gates green.

## Phase 2: Store and publish run

1. `src/db/articles.ts`: `publishArticle(ctx, input)`; reads `findArticleBySlug`,
   `getPublishedArticle`, `findSlugRedirect`, `listArticles(ctx, { kind?, cluster? })` (published,
   newest first, ties by slug).
2. `src/db/publish-run.ts`: `runBlogPublish(ctx, files, { commit, withdraw, gate })` returning
   `{ status: "refused", problems }` or `{ status: "done", committed, changes, warnings }`; changes carry
   kind, action, statuses before and after, slug and previous slug (BL-5 input).
3. `src/server/index.ts` exports, `src/server/health.ts`.

### Phase 2 checks
- Automated: `tests/articles.test.ts` (FIRE `blog.test.ts` cases and the constraints, including the
  deferred pillar exclusion), `tests/publish-run.test.ts` (FIRE `blog-publish.test.ts` cases without
  IndexNow and the CLI part); gates green.

## Phase 3: CLI and docs

1. `src/cli/{run,command,bin,index}.ts`: `softure-blog publish [path…] [--commit] [--withdraw]
   [--config <file>]`; a folder publishes every `*.md` but `README.md` sorted by name; no path → the
   configured `contentDir`; `--withdraw` with exactly one file; exit 0 done, 1 refused or failed,
   2 usage. `runBlogCli({ config, argv, cwd, output, openDatabase, gate })` for app scripts.
2. `README.md` (twelve sections, file format, FIRE key mapping, adoption notes), `migrations/README.md`.
3. Docs links: backlog README already points at `context/changes/`.

### Phase 3 checks
- Automated: `tests/cli.test.ts` (dry run over a folder with a README, commit then unchanged, usage
  errors before the database, `--withdraw` rules, a missing config); `npm run build`; gates green.
- Manual: `softure-blog publish` against the local Postgres 16 with a throwaway config.

## Risks and rollback

- Risk: the hash or the file format turns out wrong for BL-3…BL-6 → both are internal until BL-8
  publishes the package; a later item can change them with a migration while no app uses the module.
- Rollback: the module is new; revert the merge. Database: `DROP SCHEMA blog CASCADE` and the ledger
  rows of module `blog`.

## Decisions (auto)

- `--stdin` and `--indexnow` are not ported: the first is FIRE's `ssh` transport (deploy roadmap),
  the second is BL-5.

## Progress

### Phase 1: Module, migration and file format

#### Automated
- [ ] 1.1 Article file, module and messages tests pass
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: Store and publish run

#### Automated
- [ ] 2.1 Store, constraint and run tests pass on PGlite
- [ ] 2.2 Gates green (typecheck, lint, test)

### Phase 3: CLI and docs

#### Automated
- [ ] 3.1 CLI tests pass
- [ ] 3.2 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 3.3 `softure-blog publish` dry run and commit against the local Postgres 16
