# Plan: blog-analytics-adoption-gaps

Input: change.md (research folded into its Context, framing skipped, see its Notes). Complexity: medium.

## Goal

An app that already runs its own blog and funnel can switch to `@softure-ai/blog` and `@softure-ai/analytics`
without losing anything readers, crawlers or its reports see: directive charts render, a release publishes through
an ssh pipe and reads a line contract, the first publish keeps every date and old slug, agents get Markdown, and
pages cached with the old beacon format keep counting under the same channels.

**Out of scope:** an HTML-to-Markdown converter for non-blog pages; container directives (`:::name … :::`) and
inline directives (`:name[…]`); a migration of the module tables; changes to ui/charts (#197's thread).

## Approach

**Starting point:** see change.md Context.

**Chosen:** each point extends an existing seam with an opt-in option whose default is today's behaviour.
- Directives reuse `BlockPlugin` (one registry, one `requires` check) with a `syntax` field, instead of a second
  plugin kind.
- Remote publish keeps one code path: `--stdin` only changes where the files come from, `--format lines` only how
  the result is printed.
- History import is an input of the publish run that applies only to an article without a row, so a re-run is
  idempotent and no later publish is affected.
- Markdown for agents is built from the stored Markdown (exact, no HTML round trip), as a proxy piece next to
  `createBlogRedirects`.
- Analytics options stay serialisable where the browser needs them (`normalize` is a named mode, so
  `getChannelRule` can carry it); the Referer hook is server-only and may be a function.

Rejected: a separate directive plugin type (two registries, two `requires` paths); reading history directly from
the app's tables inside the package (it would hard-code another schema; the app exports a JSON file with one SQL
query instead, documented); a `normalizeChannel` function (the browser keeper cannot receive a function, so the
server and the browser would disagree).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Directive syntax | a top-level line `::name` or `::name{key="value" …}`, name lower-case kebab-case, values double-quoted without `"` | what existing articles use; matches the gate's `directive` blocks | issue, adopting app |
| Plugin field | `syntax: "fence" \| "directive"`, default `"fence"` | one registry; old plugins unchanged | plan |
| Block input | `ArticleBlock` gains `syntax` and `attributes` (`{}` for fences); for a directive `info` is the raw text inside `{…}` and `content` the whole line | plugins read either form | plan |
| Unreadable attributes | the renderer passes `attributes: null`; the gate reports `block-directive` (error) | the plugin can still render an error frame; the gate stops it before publish | plan |
| Unknown directive | gate error `block-directive` when the app registers any directive plugin | a typo would render as a paragraph `::char{…}` | plan |
| Stdin input | `--stdin --name <slug>.md` reads one file; `--stdin` alone reads a JSON bundle `{ "files": [{ "name", "text" }] }` | one file from an editor's machine, the whole folder from a release | issue, adopting app |
| Line contract | `--format lines`: `blog|<kind>|<field>|…`, `|` and newlines in values replaced by spaces; exit codes unchanged | grep-able in bash; stable keys in English | issue |
| History input | `--history <file.json>`: `{ "articles": [{ "id", "published_at", "updated_at"?, "old_slugs"?: [{ "slug", "changed_at"? }] }] }`, zod-validated | the shape one SQL query over the app's tables produces | plan |
| History scope | applied only when the article has no row; file `published_at` still wins; an entry for an id outside the run is a warning | idempotent re-runs; the file stays the source of truth | plan |
| Markdown page | `createBlogMarkdown(config)` (proxy): GET/HEAD of an article or term path whose `Accept` names `text/markdown` with q ≥ `text/html`; title, description, summary, body, sources, FAQ; `Vary: Accept`, `private` cache | an explicit request only, so browsers and crawlers sending `*/*` keep HTML | adopting app |
| Block in Markdown | optional `BlockPlugin.markdown(block)`; without it the block's source stays | the source line still tells an agent what is there | plan |
| Wire format | `funnel.wire: { stepFields: string[] = ["step"], channelField: string \| null = null }`; the first step field is what the package sends | old pages send `k=`, new ones `step=`; both count | issue |
| Body channel | used only when the request is first-party (same Referer check) and the value passes the rule; else the page's channel | no new oracle or bypass | plan |
| Referer channel | `channel.fromReferer(url: URL) => string \| null`, called when neither the request URL nor the Referer has the tag; result passes the rule | issue point 6 | issue |
| Normalisation | `channel.normalize: "none" \| "trim-lowercase"`, default `"none"`, applied in `parseChannel` (server and keeper) | serialisable to the browser | plan |
| Versions | blog 0.1.7, analytics 0.1.7 (package.json, module.json, manifest), CHANGELOG entries | auto-release reads package.json | workflow |

## Phase 1: directive blocks in the renderer and the gate

**Discipline:** TDD. **Files:** `modules/blog/src/render/render-article.ts`, `modules/blog/src/render/index.ts`,
`modules/blog/src/options.ts`, `modules/blog/src/quality/options.ts`, `modules/blog/src/quality/rules/blocks.ts`,
`modules/blog/src/quality/check-article.ts`, `modules/blog/src/quality/catalog.ts`, tests in
`modules/blog/tests/render-blocks.test.ts`, `modules/blog/tests/quality/*.test.ts`.

1. Tests (red first): a directive line between paragraphs, directly under a paragraph line, as the whole text;
   attributes parsed; `::name` without braces; unreadable attributes → `attributes: null`; a directive inside a
   list, a quote, a fence or indented four spaces stays text/code; an unregistered name stays a paragraph; a fence
   plugin is not triggered by a directive of the same name and vice versa; `findArticleBlocks` reports directives
   with lines; the gate reports `requires`, an unknown directive and unreadable attributes.
2. `BlockPlugin.syntax`, `ArticleBlock.syntax/attributes`, `FoundBlock.syntax/attributes/error`; a block rule
   `blog_directive` before `paragraph` (alt paragraph) at `state.level === 0` and indent < 4; `parseDirective`.
3. Registry: type unique per syntax; option validators accept `syntax`.
4. Gate: `checkBlockRequires` unchanged in shape; new `checkDirectives(body blocks, pluginBlocks, plugins)` →
   `block-directive` for a directive line no plugin renders or whose attributes cannot be read; catalog lists the
   rule when any directive plugin is registered.

**Done when:** Automated: new tests red before, green after; gates green.

## Phase 2: Markdown for agents

**Discipline:** TDD. **Files:** `modules/blog/src/render/article-markdown.ts` (new), `modules/blog/src/render/index.ts`,
`modules/blog/src/proxy/index.ts`, `modules/blog/src/pages/accept.ts` (new), tests
`modules/blog/tests/article-markdown.test.ts`, `modules/blog/tests/proxy.test.ts`.

1. Tests: `toArticleMarkdown` composes title, description, summary, body (plugin blocks replaced by their
   `markdown` output or kept), sources and FAQ; `prefersMarkdown(accept)` cases (`*/*`, `text/html`,
   `text/markdown`, q-values, ties); the proxy piece answers a published article and a term with
   `text/markdown; charset=utf-8`, `Vary: Accept`, `cache-control: private…`; HEAD has no body; draft, withdrawn,
   unknown slug, listing paths and non-markdown `Accept` → `null`.
2. Implementation as tested; the messages for "Sources" and "FAQ" headings come from the blog messages (en/pl).

**Done when:** Automated: tests red before, green after; gates green.

## Phase 3: publish from standard input with a line contract

**Discipline:** TDD. **Files:** `modules/blog/src/cli/run.ts`, `modules/blog/src/cli/command.ts`,
`modules/blog/src/cli/report.ts` (new: human and line reporters), tests `modules/blog/tests/cli.test.ts`.

1. Tests: `--stdin --name x.md` publishes one file read from the injected `stdin`; `--stdin` with a JSON bundle
   publishes several; a bad bundle, `--name` without `--stdin`, `--stdin` with paths, a name not ending `.md` are
   usage/read errors; `--format lines` prints the exact contract for a dry run, a commit, a refusal, cache and
   IndexNow outcomes; `|` inside a message is replaced; human output unchanged.
2. `RunBlogCliOptions.readStdin?: () => Promise<string>` (default reads `process.stdin`).

**Done when:** Automated: tests red before, green after; gates green.

## Phase 4: history import on the first publish

**Discipline:** TDD. **Files:** `modules/blog/src/db/history.ts` (new: schema, parse), `modules/blog/src/db/articles.ts`,
`modules/blog/src/db/publish-run.ts`, `modules/blog/src/cli/run.ts`, tests `modules/blog/tests/history.test.ts`
(Postgres, like `publish-run.test.ts`).

1. Tests: first publish with history keeps `published_at` and `updated_at`, writes the old slugs (301 works) and
   reports `imported`; a second run with the same history is `unchanged`; history for an existing row is ignored;
   the file's `published_at` wins; an old slug that is another article's slug or history refuses the run; an entry
   for an id outside the run is a warning; an invalid file is a read error naming the field; `updated_at` without
   `published_at` refused; the CLI flag reads the file.
2. `publishArticle(ctx, input, { history })`; `PublishedChange.imported: boolean`; human line
   `imported <id> published_at=… old_slugs=…` and contract line `blog|imported|<id>|<published_at>|<n>`.
3. README: the SQL query that exports the JSON from an app's own tables.

**Done when:** Automated: tests red before, green after; gates green.

## Phase 5: analytics wire format, Referer channel and normalisation

**Discipline:** TDD. **Files:** `modules/analytics/src/options.ts`, `modules/analytics/src/channel-rule.ts`,
`modules/analytics/src/server/channel.ts`, `modules/analytics/src/server/endpoint.ts`,
`modules/analytics/src/server/options.ts`, `modules/analytics/src/client/*.ts`, `modules/analytics/src/next/funnel.tsx`,
`modules/analytics/src/ui/funnel-beacon.tsx`, tests in `modules/analytics/tests/`.

1. Tests: `k=` beacon counted with `stepFields: ["step", "k"]`; two fields at once or a field twice count nothing;
   pixel and beacon component send the first field; `channelField: "z"` takes the body channel, falls back to the
   page's, ignores an invalid one; `fromReferer` gives `blog` for `/blog/x` with no tag, never overrides a tag, its
   result passes the rule, a throw is treated as no channel; `normalize: "trim-lowercase"` accepts `" News "` as
   `news` in `readChannel`, the keeper and `recordFunnelStep`; defaults unchanged; option validation errors.
2. Implementation as tested; `getChannelRule` carries `normalize`.

**Done when:** Automated: tests red before, green after; gates green.

## Phase 6: docs, versions

**Files:** both READMEs (blog §10/§12 and new sections, analytics §1 and options), both CHANGELOGs, versions 0.1.7 in
`package.json`, `module.json`, `src/index.ts` of both modules.

**Done when:** Automated: gates green (repo tests check links and package shape). Manual: the README examples
type-check (verified by agent in a scratch test).

## Risks and rollback

- A directive rule that grabs lines it should not: it acts only on registered names at the top level; apps without
  directive plugins see no change.
- The markdown piece serving a draft: it reads `getPublishedArticle` only.
- History import with a wrong date: it applies once per article; fixing it means setting `published_at` in the file
  (the file wins on every later publish).
- Rollback: revert the phase commits; no schema change.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: directive blocks in the renderer and the gate

#### Automated
- [ ] 1.1 New tests fail before the implementation and pass after
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: Markdown for agents

#### Automated
- [ ] 2.1 New tests fail before the implementation and pass after
- [ ] 2.2 Gates green (typecheck, lint, test)

### Phase 3: publish from standard input with a line contract

#### Automated
- [ ] 3.1 New tests fail before the implementation and pass after
- [ ] 3.2 Gates green (typecheck, lint, test)

### Phase 4: history import on the first publish

#### Automated
- [ ] 4.1 New tests fail before the implementation and pass after
- [ ] 4.2 Gates green (typecheck, lint, test)

### Phase 5: analytics wire format, Referer channel and normalisation

#### Automated
- [ ] 5.1 New tests fail before the implementation and pass after
- [ ] 5.2 Gates green (typecheck, lint, test)

### Phase 6: docs, versions

#### Automated
- [ ] 6.1 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 6.2 README examples type-check
