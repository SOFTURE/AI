# Backlog: roadmap-blog-followups (gaps found while delivering the blog roadmap)

Roadmap of this group: [`foundation/roadmaps/roadmap-blog-followups.md`](../../foundation/roadmaps/roadmap-blog-followups.md)
(queued, the catch-all of the [blog roadmap](../../foundation/roadmap.md)). That file holds the order, owner
decisions and the status of each item, and says how a thread adds a gap.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly
one place: here, in `context/changes/` or in `context/archive/`.

## Adding an item

1. Take the next free `BF-<n>` and a kebab-case change-id.
2. Write `<change-id>/change.md` like the entries of [`roadmap-blog/`](../roadmap-blog/) (`status: backlog`, the
   item block quoted in Context, **Source** naming the change and the finding).
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
| BF-1 | [`cli-config-loader`](cli-config-loader/change.md) | One config loader for module commands | roadmap promoted | start |
| BF-2 | [`blog-publish-slug-race`](blog-publish-slug-race/change.md) | A slug race reports a taken slug | roadmap promoted | start |
| BF-3 | [`blog-article-images`](blog-article-images/change.md) | Images in article bodies | roadmap promoted | start |
| BF-4 | [`blog-glossary-form-conflicts`](blog-glossary-form-conflicts/change.md) | A glossary form belongs to one term | roadmap promoted | start |
| BF-5 | [`markdown-footnote-links`](markdown-footnote-links/change.md) | The repository link check skips footnote definitions | roadmap promoted | start |
| BF-6 | [`blog-check-without-database`](blog-check-without-database/change.md) | softure-blog check without a database URL | roadmap promoted | start |

Kind: `start`, `dependency` or `owner`, as in the other roadmap backlogs.
