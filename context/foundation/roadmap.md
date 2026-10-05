---
project: "SOFTURE AI"
roadmap: blog-followups
version: 1
status: ready
prd_version: 2
created: 2026-10-04
updated: 2026-10-05
backlog: context/backlog/roadmap-blog-followups/
---

# Roadmap blog-followups: gaps found while delivering the blog roadmap

> Entries: [`context/backlog/roadmap-blog-followups/`](../backlog/roadmap-blog-followups/). An entry is taken
> (moved to `context/changes/<id>/`) when its item starts.
>
> Promoted by the owner on 2026-10-05, with no main roadmap in flight: blog closed on 2026-10-04 (archived in
> [`archive/2026-10-04-2-roadmap.md`](archive/2026-10-04-2-roadmap.md)) and this was its queued catch-all. BF-5 was
> already fixed inside BL-4 (see Done). Still queued in [`roadmaps/`](roadmaps/README.md): `charts`, `deploy` and
> `later` (BL-8, MK-8, EN-9, MO-6 and LT-1 wait on the owner there).
>
> The catch-all of the [`blog`](archive/2026-10-04-2-roadmap.md) roadmap (owner, 2026-10-03: gaps found while
> delivering a roadmap are collected in a catch-all roadmap, not fixed on the spot). A gap or deferred review
> finding found while delivering this roadmap lands here too:
> 1. take the next free `BF-<n>` (BF-12 is next) and a kebab-case change-id;
> 2. write `context/backlog/roadmap-blog-followups/<change-id>/change.md` (`status: backlog`, the item block quoted
>    in Context, **Source** naming the change and the finding);
> 3. add the row and the item block here (status `proposed`, or `blocked (…)` when it waits on the owner) and the
>    row in the backlog README. Mark the severity in **Risk** and say in **Mode** whether it needs the owner.
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Process: every item runs the full softure chain (new → research → frame → plan → plan review → implement →
>   impl review → archive); skipping research or framing is justified in `change.md` (owner, 2026-10-03).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.
>   `@softure-ai/blog` is not published yet, so its changes ride its first publish (BL-8 in `later`).
> - Owner at the keyboard: none (see "Owner at the keyboard?" below).
>
> FIRE_TRACKER (owner, 2026-10-03): read only. Items may copy its code; none changes it.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **BF-1** | `cli-config-loader` | `softure migrate`, `softure-mail` and `softure-blog` load the app config through one shared loader | — | autonomous | done_code (2026-10-05; waiting: the owner's release of `@softure-ai/core`, `@softure-ai/db`, `@softure-ai/mailing` and `@softure-ai/blog`) |
| **BF-2** | `blog-publish-slug-race` | two publishes racing for one slug report `blog.slug_taken`, not a driver error | — | autonomous | ready |
| **BF-3** | `blog-article-images` | images in article bodies under a hosting policy (allowed sources, alt, dimensions) | — | autonomous | done_code (2026-10-05; waiting: the first release of `@softure-ai/blog`, BL-8) |
| **BF-4** | `blog-glossary-form-conflicts` | a glossary form claimed by two terms is refused, naming both | BF-3 | autonomous | done_code (2026-10-05; waiting: the first release of `@softure-ai/blog`, BL-8) |
| **BF-6** | `blog-check-without-database` | `softure-blog check` runs with an app config that has no database URL | BF-1 | autonomous | done_code (2026-10-05; waiting: the owner's release of `@softure-ai/core` and `@softure-ai/blog`) |
| **BF-7** | `blog-seo-canonical` | the blog's canonical, OG and JSON-LD URLs follow `@softure-ai/seo`'s canonical host and trailing-slash rule | — | autonomous | done_code (2026-10-05; waiting: the next release of `@softure-ai/core` and `@softure-ai/seo`, and the first of `@softure-ai/blog`, BL-8) |
| **BF-8** | `blog-og-fonts` | `blog({ brand: { fonts } })` gives the article OG card the brand's fonts | BF-7 | autonomous | ready |
| **BF-9** | `blog-skill-app-notes` | the generated writing skill carries the app's own sections across reinstalls | — | autonomous | done_code (2026-10-05; waiting: the first release of `@softure-ai/blog`, BL-8) |
| **BF-10** | `blog-publish-cache-refresh` | `softure-blog publish --commit` refreshes the running app's blog cache before the IndexNow submit | BF-2 | autonomous | ready |
| **BF-11** | `blog-canonical-host-links` | a body link to seo's canonical host counts as internal in the renderer and the gate | BF-7 | autonomous | proposed |
| **BF-13** | `blog-skill-check-without-database` | `softure-blog skill install` runs with an app config that has no database URL | BF-6 | autonomous | **in_progress (implement 1/1, since 2026-10-05; cloud session, branch `claude/project-thread-fjndju` — do not take in another session)** |

## Order

Lanes follow file ownership: items in one lane share files, so they run one after another; different lanes run in
parallel, up to 4 at once. "Depends on" in the table is the item before it in its lane.

| Lane | Items, in order | Shared files |
| --- | --- | --- |
| A: config loading | BF-1 → BF-6 → BF-13 | `foundation/db/src/cli/command.ts` (or `foundation/core/`), `modules/mailing/src/cli/command.ts`, `modules/blog/src/cli/command.ts`; BF-6 also the blog workflow's `DATABASE_URL` |
| B: publish run | BF-2 → BF-10 | `modules/blog/src/db/publish-run.ts`, `modules/blog/src/cli/run.ts`; BF-10 also `src/next/` (route handler) and `src/discovery/submit.ts` |
| C: render and quality | BF-3 → BF-4 | `modules/blog/src/render/` (`render-article.ts`, `glossary.ts`), `modules/blog/src/quality/` |
| D: pages and OG | BF-7 → BF-8 | `modules/blog/src/pages/`, `modules/blog/src/next/` (`pages.tsx`, `og-image.tsx`) |
| E: writing skill | BF-9 | `modules/blog/src/cli/skill.ts`, the skill template |

1. **First wave: BF-1, BF-2, BF-3, BF-7**, the head of lanes A to D.
2. **Each free slot** takes the first item of this list whose lane is idle and whose dependency is on `master`:
   BF-9, BF-6, BF-4, BF-8, BF-10.
3. **BF-11** (a gap filed by BF-7) touches lanes C and D (`src/quality/settings.ts`, `src/pages/body.ts`): it runs
   when both are idle, after BF-4 and BF-8.
4. **BF-13** (a gap filed by BF-6) is lane A's next item: one line in `modules/blog/src/cli/command.ts` and a bin
   test.

`modules/blog/src/options.ts`, `src/messages/` and the example app (`examples/next-app/`) are touched by several
lanes; `master` is the source of truth and each thread merges it and resolves the conflicts itself.

## Owner at the keyboard?

Assessed on 2026-10-05 against what a cloud session cannot do: secrets, provider accounts, paid API calls, the
owner's own machine, a product decision only the owner can make, or a change in FIRE_TRACKER.

| ID | Needs the owner | Why |
| --- | --- | --- |
| BF-1 | no | a shared loader in foundation code; the three bins' tests keep their messages |
| BF-2 | no | a mapped SQLSTATE; a two-connection test on the local Postgres |
| BF-3 | no | an image policy option in the renderer and a quality rule; unit tests |
| BF-4 | no | a check over the content folder; unit tests |
| BF-6 | no | a config option in core or the bin; the workflow change is a file in this repository |
| BF-7 | no | URL building through `@softure-ai/seo`'s helper; unit tests |
| BF-8 | no | font files read from a path or URL; tested with a local subset font |
| BF-9 | no | an option or a preserved local file in the skill install; `--check` tests |
| BF-10 | no | the route secret comes from the environment; tests use a fake app URL, no real deploy |
| BF-11 | no | two host lists in the blog; unit tests |
| BF-13 | no | a loader option in the blog bin; a bin test |

## Items

### BF-1: One config loader for module commands
- **Change ID:** `cli-config-loader`
- **Status:** done_code (2026-10-05; waiting: the owner's release of `@softure-ai/core`, `@softure-ai/db`, `@softure-ai/mailing` and `@softure-ai/blog`)
- **Input:** [`context/archive/2026-10-05-cli-config-loader/`](../archive/2026-10-05-cli-config-loader/change.md)
- **Outcome:** `findDefaultConfig`, `takeConfigOption` and `loadConfig` live once (in `@softure-ai/core` or `@softure-ai/db`) and the three bins use them; their tests keep the same messages.
- **Prerequisites:** none.
- **Risk:** low. Three copies of about 60 lines that have not drifted yet.
- **Mode:** autonomous.
- **Source:** BL-2 `blog-content-store` impl review R1.

### BF-2: A slug race reports a taken slug
- **Change ID:** `blog-publish-slug-race`
- **Status:** ready
- **Input:** [`blog-publish-slug-race`](../backlog/roadmap-blog-followups/blog-publish-slug-race/change.md)
- **Outcome:** `runBlogPublish` maps a unique violation on `articles_slug_key` (SQLSTATE 23505) to a refused run naming the slug; a two-connection test on Postgres covers it.
- **Prerequisites:** none.
- **Risk:** low. Publishing runs from one place; the database already refuses the second write, only the message is raw.
- **Mode:** autonomous.
- **Source:** BL-2 `blog-content-store` impl review R2.

### BF-3: Images in article bodies
- **Change ID:** `blog-article-images`
- **Status:** done_code (2026-10-05; waiting: the first release of `@softure-ai/blog`, BL-8)
- **Input:** [`context/archive/2026-10-05-blog-article-images/`](../archive/2026-10-05-blog-article-images/change.md)
- **Outcome:** `renderArticle({ images })` takes an image policy (allowed sources, a resolver that gives width and height); an image outside it stays text; the quality gate (BL-6) reports a missing alt or a refused source.
- **Prerequisites:** none.
- **Risk:** low. The renderer disables images today, so nothing unsafe ships; texts just cannot show one.
- **Mode:** autonomous.
- **Source:** BL-3 `blog-markdown-renderer` impl review R1.

### BF-4: A glossary form belongs to one term
- **Change ID:** `blog-glossary-form-conflicts`
- **Status:** done_code (2026-10-05; waiting: the first release of `@softure-ai/blog`, BL-8)
- **Input:** [`context/archive/2026-10-05-blog-glossary-form-conflicts/`](../archive/2026-10-05-blog-glossary-form-conflicts/change.md)
- **Outcome:** a check over the whole content folder (a publish-run problem or a BL-6 rule) refuses a form claimed by two terms, naming both slugs; the renderer's "first term wins" stays as the deterministic fallback.
- **Prerequisites:** none.
- **Risk:** low. An editorial mistake that links a phrase to the wrong definition; no security impact.
- **Mode:** autonomous.
- **Source:** BL-3 `blog-markdown-renderer` impl review R2.

### BF-6: softure-blog check without a database URL
- **Change ID:** `blog-check-without-database`
- **Status:** done_code (2026-10-05; waiting: the owner's release of `@softure-ai/core` and `@softure-ai/blog`)
- **Input:** [`context/archive/2026-10-05-blog-check-without-database/`](../archive/2026-10-05-blog-check-without-database/change.md)
- **Outcome:** `softure-blog check` loads an app config that has no database URL (or a placeholder) without failing: either core lets a command opt out of the database requirement, or the blog bin builds a check-only config; the weekly workflow drops its placeholder `DATABASE_URL`.
- **Prerequisites:** none.
- **Risk:** low. The reusable workflow passes a placeholder URL today; `check` never connects.
- **Mode:** autonomous.
- **Source:** BL-6 `blog-quality-gate` impl review R2.

### BF-7: Blog URLs follow the seo canonical rule
- **Change ID:** `blog-seo-canonical`
- **Status:** done_code (2026-10-05; waiting: the next release of `@softure-ai/core` and `@softure-ai/seo`, and the first of `@softure-ai/blog`, BL-8)
- **Input:** [`context/archive/2026-10-05-blog-seo-canonical/`](../archive/2026-10-05-blog-seo-canonical/change.md)
- **Outcome:** the blog's pages build canonical, OG and JSON-LD URLs through `@softure-ai/seo`'s canonical URL helper when `seo()` is in the config, and on `appOrigin` otherwise; a test covers a canonical host that differs from `appOrigin` and a trailing-slash rule.
- **Prerequisites:** none.
- **Risk:** low. The example app's canonical host equals `appOrigin`; only an app with another canonical host is affected.
- **Mode:** autonomous.
- **Source:** BL-4 `blog-pages` impl review R1.

### BF-8: The OG card takes the brand's fonts
- **Change ID:** `blog-og-fonts`
- **Status:** ready
- **Input:** [`blog-og-fonts`](../backlog/roadmap-blog-followups/blog-og-fonts/change.md)
- **Outcome:** `brand.fonts` (name, weight, a path or URL the server reads once and caches) feeds `BlogArticleOgImage`; a missing file fails with a message naming it; marketing-kit's subset fonts are a candidate source.
- **Prerequisites:** none.
- **Risk:** low. Cosmetic: the card uses `next/og`'s default font today.
- **Mode:** autonomous.
- **Source:** BL-4 `blog-pages` impl review R2.

### BF-9: The app's own sections in the generated writing skill
- **Change ID:** `blog-skill-app-notes`
- **Status:** done_code (2026-10-05; waiting: the first release of `@softure-ai/blog`, BL-8)
- **Input:** [`context/archive/2026-10-05-blog-skill-app-notes/`](../archive/2026-10-05-blog-skill-app-notes/change.md)
- **Outcome:** the generated skill carries the app's own sections, from an option such as `blog({ skill: { notes } })` or from a local file the install preserves; FIRE_TRACKER's engine numbers, calculator scenario and chart block fit there; `--check` covers them.
- **Prerequisites:** none.
- **Risk:** low. Today an app keeps such guidance in a second skill of its own.
- **Mode:** autonomous.
- **Source:** BL-7 `blog-writing-skill` research, "Gaps".

### BF-10: A command-line publish refreshes the app's cache
- **Change ID:** `blog-publish-cache-refresh`
- **Status:** ready
- **Input:** [`blog-publish-cache-refresh`](../backlog/roadmap-blog-followups/blog-publish-cache-refresh/change.md)
- **Outcome:** an authenticated route handler from `@softure-ai/blog/next` (a secret from the environment, rate-limited) calls `revalidateTag("softure-blog")`; `softure-blog publish --commit` calls it before the IndexNow submit when the app gives its URL; without it the command says the app refreshes after `revalidateSeconds`.
- **Prerequisites:** none.
- **Risk:** low. Today the window is `revalidateSeconds` (300 s by default), as in FIRE_TRACKER.
- **Mode:** autonomous.
- **Source:** BL-5 `blog-discovery` research Q5.

### BF-11: A body link to seo's canonical host counts as internal
- **Change ID:** `blog-canonical-host-links`
- **Status:** proposed
- **Input:** [`blog-canonical-host-links`](../backlog/roadmap-blog-followups/blog-canonical-host-links/change.md)
- **Outcome:** the renderer's own hosts (`pages/body.ts` `siteHosts`) and the gate's own origins (`quality/settings.ts` `ownOrigins`) include core's `getSiteUrls(config).origin` next to `appOrigin`; a test covers a canonical host that differs from `appOrigin`.
- **Prerequisites:** BF-7 on `master` (core's `getSiteUrls`).
- **Risk:** low. An app can list the host in `siteHosts` and `quality.ownOrigins` today; the example's canonical host equals `appOrigin`.
- **Mode:** autonomous.
- **Source:** BF-7 `blog-seo-canonical` plan review S1.

### BF-13: softure-blog skill install without a database URL
- **Change ID:** `blog-skill-check-without-database`
- **Status:** in_progress (implement 1/1, since 2026-10-05; cloud session, branch `claude/project-thread-fjndju` — do not take in another session)
- **Input:** [`blog-skill-check-without-database`](../changes/blog-skill-check-without-database/change.md)
- **Outcome:** the blog bin loads the config with `database: "optional"` for `skill install` as it does for `check`; a bin test runs `skill install --check` over a config without a database URL.
- **Prerequisites:** BF-6 on `master` (the loader's `database` option).
- **Risk:** low. A CI job that runs `skill install --check` passes a placeholder `DATABASE_URL` today; nothing connects.
- **Mode:** autonomous.
- **Source:** BF-6 `blog-check-without-database` plan review S1.

## Owner decisions and checks

(none yet)

## Done

- **BF-9** `blog-skill-app-notes` (done_code 2026-10-05): `blog({ skill: { sections } })` puts the app's own sections into the generated writing skill (`references/app.md`, named in `SKILL.md`), kept across reinstalls and covered by `--check`; install removes a Markdown file of its folder the config no longer gives; archived in [`archive/2026-10-05-blog-skill-app-notes/`](../archive/2026-10-05-blog-skill-app-notes/change.md).
- **BF-3** `blog-article-images`: `renderArticle({ images })` and `blog({ images: { hosts, dimensions } })` show body images from site paths or allowed https hosts with alt text and a known size (`width`/`height`, lazy), any other as its alt text; the gate reports `image-source`, `image-alt` and `image-dimensions` (`findArticleImages`, `checkArticleImage`), and an image no longer counts as a link; no gaps; archived in `archive/2026-10-05-blog-article-images/`
- **BF-1** `cli-config-loader` (done 2026-10-05): `@softure-ai/core/cli` (`takeConfigOption`, `findDefaultConfig`, `loadConfig`, `loadAppConfig`, `DEFAULT_CONFIG_FILES`) is the one config loader of `softure migrate`, `softure-mail` and `softure-blog`; their messages and tests are unchanged; no gaps; archived in [`archive/2026-10-05-cli-config-loader/`](../archive/2026-10-05-cli-config-loader/change.md)
- **BF-6** `blog-check-without-database` (done_code 2026-10-05): `softure-blog check` loads an app config without a database URL: `withDatabaseOptional` in `@softure-ai/core` reads a missing or empty URL as no database while the config is imported, `@softure-ai/core/cli`'s loaders take `database: "optional"`, and `blog-links.yml` drops its placeholder `DATABASE_URL`; gap BF-13; archived in [`archive/2026-10-05-blog-check-without-database/`](../archive/2026-10-05-blog-check-without-database/change.md)
- **BF-7** `blog-seo-canonical` (done_code 2026-10-05): core's `getSiteUrls(config)` is a site-URL contract (one provider, `appOrigin` fallback) and `@softure-ai/seo` provides it with `buildCanonicalUrl`; the blog's canonical, OG, JSON-LD and feed URLs use it, so they follow seo's host and trailing-slash rule, and the blog's Next code never imports seo; gap BF-11; archived in [`archive/2026-10-05-blog-seo-canonical/`](../archive/2026-10-05-blog-seo-canonical/change.md)
- **BF-4** `blog-glossary-form-conflicts`: `findTermFormConflicts` (forms equal after a capital first letter collide, as in the matcher); `softure-blog publish` refuses a run that leaves a form with two published terms, one of them in the run, naming the form and both slugs (a conflict only between stored terms warns); `softure-blog check` reports `term-form-conflict`; the renderer keeps "first term wins"; no gaps; archived in `archive/2026-10-05-blog-glossary-form-conflicts/`
- **BF-5** `markdown-footnote-links` (done 2026-10-04): `tests/repo/markdown-links.ts` skips footnote definitions (`[^id]: …`), with a test; fixed inside BL-4 `blog-pages` (impl review R3), archived with it in [`archive/2026-10-04-blog-pages/`](../archive/2026-10-04-blog-pages/change.md)
