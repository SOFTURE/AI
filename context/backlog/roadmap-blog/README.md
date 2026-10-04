# Backlog: roadmap-blog (a Markdown blog with SEO, AI crawler access and a text quality gate)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-04).
That file holds the order, lanes, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly
one place: here, in `context/changes/` or in `context/archive/`.

## Taking an entry

When an item becomes active work, move its entry and let `softure-new` write the real `change.md`:

```bash
git mv context/backlog/roadmap-blog/<id>/change.md context/changes/<id>/backlog-input.md
```

Then remove the empty folder here. Relative links in the moved file lose one `../`. The roadmap row goes
to `in_progress` (WORKFLOW §5.1).

## When it can start

The roadmap was promoted on 2026-10-04, when it was written. Inside it, the order comes from dependencies:

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| BL-1 | `seo-crawler-access` (done, in [`context/archive/`](../../archive/2026-10-04-seo-crawler-access/change.md)) | SEO and AI crawler access | roadmap promoted | start |
| BL-2 | [`blog-content-store`](../../archive/2026-10-04-blog-content-store/change.md) | Blog content store and publish script | roadmap promoted | start |
| BL-3 | [`blog-markdown-renderer`](blog-markdown-renderer/change.md) | Safe Markdown renderer with glossary links | BL-2 on master | dependency |
| BL-4 | [`blog-pages`](blog-pages/change.md) | Blog pages | BL-3 on master | dependency |
| BL-5 | [`blog-discovery`](blog-discovery/change.md) | Blog discovery: RSS, sitemap and IndexNow | BL-1 and BL-4 on master | dependency |
| BL-6 | `blog-quality-gate` (done, in [`context/archive/`](../../archive/2026-10-04-blog-quality-gate/change.md)) | Text quality gate | BL-2 on master | dependency |
| BL-7 | [`blog-writing-skill`](blog-writing-skill/change.md) | Article writing skill | BL-6 on master | dependency |
| BL-8 | [`blog-release`](blog-release/change.md) | SEO and blog release | BL-1…BL-7 on master **and** the owner approves the first npm publish | dependency + owner |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

When the last entry is taken, delete this folder.
