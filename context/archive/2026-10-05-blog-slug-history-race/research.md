# Research: blog-slug-history-race

Sources: `modules/blog/src/db/articles.ts` (`publishArticle`), `modules/blog/src/db/publish-run.ts`
(`runBlogPublish`), `modules/blog/migrations/0001_create_articles.sql`, `modules/blog/tests/postgres.ts` and
`publish-race.test.ts` (BF-2's harness), BF-2's research ("Gap found").

## Summary

The race does not happen. `publishArticle` checks a slug with two reads, in this order: the current slugs
(`articles`), then the old ones (`slug_history`). A rename writes both tables in one transaction, so at
read committed each of Y's reads sees either the whole rename or none of it. A read of `articles` before X
commits sees X still at `s` (`blog.slug_taken`); a read after X commits is followed by a read of
`slug_history` that also comes after, which sees X's old slug (`blog.slug_in_history`). Y's run never
reaches its write, so it never waits on X's old index entry. BF-2's gap assumed Y "reads `s` as free",
which the first read rules out.

## Findings

1. **Reproduction attempt (PostgreSQL 16, BF-2's harness).** Article X published at `s`. A blocker
   connection opens a transaction, runs `UPDATE blog.articles SET slug = 't' WHERE id = 'x'` and inserts
   `('s', 'x')` into `blog.slug_history`, and stays open. A run publishing new article Y at `s` resolves
   at once (no lock wait) with `refused`, "slug s is the slug of article x (blog.slug_taken)". After the
   blocker commits: no article at `s`, `slug_history` = `[('s', 'x')]`. The bad state is not reached.
2. **After X commits.** The same run then reads no article at `s` and X's row in `slug_history`:
   `blog.slug_in_history`, naming X (the existing single-connection test covers the committed case; a
   race test can pin it next to the open one).
3. **The reads are plain `SELECT`s** (no `FOR UPDATE` on the slug), so they never wait; only Y's own row is
   locked (`FOR UPDATE` by id).
4. **What would open the gap:** the reverse order. Reading `slug_history` first (empty while X is open),
   then `articles` after X commits (X now at `t`) would let Y insert `s` beside X's history row. Two
   statements in that order is the only path; the current code has the safe one, but nothing says it is
   load-bearing.
5. **A database constraint** for "an old slug is no current slug" spans two tables; Postgres has no
   cross-table `CHECK`, and a trigger would need its own locking to be race-free. Not needed while the
   read order holds.

## Recommendation

No behaviour change. Pin the read order with a comment in `publishArticle` and add two-connection tests in
`publish-race.test.ts` for the rename held open (new article and renamed article) and just committed. The
README's schema paragraph names the order.
