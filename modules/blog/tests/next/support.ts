// A published blog on PGlite for the Next adapter and the proxy piece: two articles in a cluster (one
// the pillar, with a summary, FAQ and a link to a term), one without a cluster, a term, a withdrawn
// article and term, a draft, and an article renamed once (its old slug in the history).
import type { AnySoftureModule } from "@softure-ai/core";
import { runBlogPublish } from "@softure-ai/blog/server";
import { buildArticleFile, createTestBlog, type TestBlog, type TestBlogInput } from "../support.js";

export const BODY = "An index fund buys the whole market, so its expense ratio stays low.\n\n## Costs\n\nLow fees.\n\n## Risks\n\nThe market moves.";

/** `others`: modules listed before the blog, e.g. `seo()`. */
export async function createPublishedBlog(options: TestBlogInput = {}, others: readonly AnySoftureModule[] = []): Promise<TestBlog> {
  const test = await createTestBlog({ brand: { name: "Example" }, methodPage: true, disclaimer: { en: "Not investment advice." }, ...options }, others);
  const files = [
    buildArticleFile(
      { cluster: "investing-basics", pillar: true, summary: "Index funds are cheap and broad.", faq: [{ question: "Is it safe?", answer: "It follows the market." }] },
      BODY,
    ),
    buildArticleFile({ id: "bond-basics", slug: "bond-basics", title: "Bonds in plain words", cluster: "investing-basics", faq: [] }),
    buildArticleFile({ id: "taxes", slug: "taxes", title: "Taxes on gains", faq: [], sources: [] }),
    buildArticleFile({ id: "expense-ratio", slug: "expense-ratio", kind: "term", forms: ["expense ratio"], title: "Expense ratio", faq: [] }, "The yearly cost of a fund."),
    buildArticleFile({ id: "old-term", slug: "old-term", kind: "term", forms: ["old term"], title: "Old term", status: "withdrawn", published_at: "2026-09-01", faq: [] }, "Gone."),
    buildArticleFile({ id: "stale", slug: "stale", title: "Stale text", status: "withdrawn", published_at: "2026-09-01", faq: [] }),
    buildArticleFile({ id: "draft", slug: "draft", title: "Draft text", status: "draft", faq: [] }),
    buildArticleFile({ id: "renamed", slug: "renamed-before", title: "Renamed text", faq: [] }),
  ];
  const first = await runBlogPublish(test.ctx, files, { commit: true });
  if (first.status !== "done") throw new Error(`test blog: the first publish failed: ${JSON.stringify(first)}`);
  test.clock.advance(60_000);
  const renamed = await runBlogPublish(test.ctx, [buildArticleFile({ id: "renamed", slug: "renamed-after", title: "Renamed text", faq: [] })], { commit: true });
  if (renamed.status !== "done") throw new Error(`test blog: the rename failed: ${JSON.stringify(renamed)}`);
  return test;
}
