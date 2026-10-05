# Backlog: roadmap-blog-followups (gaps found while delivering the blog roadmap)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-05,
the catch-all of the [blog roadmap](../../foundation/archive/2026-10-04-2-roadmap.md), closed on 2026-10-04). That
file holds the order, lanes, owner decisions and the status of each item, and says how a thread adds a gap.
Items that share files run in one lane, so `dependency` below names the item before it in its lane.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly
one place: here, in `context/changes/` or in `context/archive/`.

## Adding an item

1. Take the next free `BF-<n>` and a kebab-case change-id.
2. Write `<change-id>/change.md` like the entries already here (`status: backlog`, the item block quoted in Context,
   **Source** naming the change and the finding).
3. Add the row to the table here and the row plus item block to the roadmap.

## Taking an entry

```bash
git mv context/backlog/roadmap-blog-followups/<id>/change.md context/changes/<id>/backlog-input.md
```

Then remove the empty folder here and let `softure-new <id>` write the real `change.md`. Relative links in the
moved file lose one `../`.

## Entries

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| BF-1 | `cli-config-loader` (done, in [`context/archive/`](../../archive/2026-10-05-cli-config-loader/change.md)) | One config loader for module commands | roadmap promoted | start |
| BF-2 | `blog-publish-slug-race` (done, in [`context/archive/`](../../archive/2026-10-05-blog-publish-slug-race/change.md)) | A slug race reports a taken slug | roadmap promoted | start |
| BF-3 | `blog-article-images` (done, in [`context/archive/`](../../archive/2026-10-05-blog-article-images/change.md)) | Images in article bodies | roadmap promoted | start |
| BF-4 | `blog-glossary-form-conflicts` (done, in [`context/archive/`](../../archive/2026-10-05-blog-glossary-form-conflicts/change.md)) | A glossary form belongs to one term | BF-3 on main | dependency |
| BF-5 | `markdown-footnote-links` (done in BL-4, [`context/archive/`](../../archive/2026-10-04-blog-pages/change.md)) | The repository link check skips footnote definitions | — | — |
| BF-6 | [`blog-check-without-database`](../../archive/2026-10-05-blog-check-without-database/change.md) | softure-blog check without a database URL | archived 2026-10-05 | start |
| BF-7 | [`blog-seo-canonical`](../../archive/2026-10-05-blog-seo-canonical/change.md) | Blog URLs follow the seo canonical rule | archived 2026-10-05 | start |
| BF-8 | [`blog-og-fonts`](blog-og-fonts/change.md) | The OG card takes the brand's fonts | BF-7 on main | dependency |
| BF-9 | [`blog-skill-app-notes`](../../archive/2026-10-05-blog-skill-app-notes/change.md) | The app's own sections in the generated writing skill | archived 2026-10-05 | start |
| BF-10 | [`blog-publish-cache-refresh`](blog-publish-cache-refresh/change.md) | A command-line publish refreshes the app's cache | BF-2 on main | dependency |
| BF-11 | [`blog-canonical-host-links`](../../archive/2026-10-05-blog-canonical-host-links/change.md) | A body link to seo's canonical host counts as internal | archived 2026-10-05 | dependency |
| BF-12 | [`blog-slug-history-race`](blog-slug-history-race/change.md) | A slug taken while another run renames away from it | roadmap promoted | start |
| BF-13 | [`blog-skill-check-without-database`](../../archive/2026-10-05-blog-skill-check-without-database/change.md) | softure-blog skill install without a database URL | archived 2026-10-05 | dependency |

Kind: `start`, `dependency` or `owner`, as in the other roadmap backlogs.
