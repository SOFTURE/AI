# Migrations

Plain SQL, forward only: `NNNN_<description>.sql`, each starting with a comment that states the
rollback plan (docs/02-module-standard.md §4). The tables live in the `blog` schema.

| File | What it does |
| --- | --- |
| `0001_create_articles.sql` | `blog.articles` and `blog.slug_history` with their constraints |
