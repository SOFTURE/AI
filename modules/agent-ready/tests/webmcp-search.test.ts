// @vitest-environment happy-dom
// The ready-made WebMCP tools: site search over the pages' Markdown and the glossary lookup (#415).
import {
  createFindTermTool,
  createSearchSiteTool,
  registerWebMcpTool,
  type ModelContextLike,
  type RegisteredWebMcpTool,
  type WebMcpToolResult,
} from "@softure-ai/agent-ready/webmcp";
import { describe, expect, it, vi } from "vitest";
import { PRICE_UNIT, SOURCE_WORD } from "./pl/words.js";

type Routes = Record<string, string | number>;

/** A fetch that answers paths from `routes` (a number is an error status) and records every call. */
function createFetch(routes: Routes) {
  const calls: { path: string; accept: string | null; credentials: RequestCredentials | undefined }[] = [];
  const fetchImpl = vi.fn((input: string, init?: RequestInit) => {
    const path = input;
    calls.push({ path, accept: new Headers(init?.headers).get("accept"), credentials: init?.credentials });
    const route = routes[path];
    if (route === undefined) return Promise.resolve(new Response("not found", { status: 404 }));
    if (typeof route === "number") return Promise.resolve(new Response("failed", { status: route }));
    return Promise.resolve(new Response(route, { status: 200 }));
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

function page(title: string, body: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\nurl: "https://example.com/x"\n---\n\n${body}\n`;
}

function sitemap(...paths: string[]): string {
  const urls = paths.map((path) => `<url><loc>https://www.example.com${path}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

function text(result: WebMcpToolResult): string {
  return result.content.map((part) => part.text).join("\n");
}

const SITE: Routes = {
  "/sitemap.xml": sitemap("/", "/pricing", "/blog/fire-basics", "/blog/glossary/etf"),
  "/": page("Home | Example", "# Home\n\nTrack your net worth and plan early retirement."),
  "/pricing": page("Pricing | Example", "# Pricing\n\nOne plan. The retirement calculator is free."),
  "/blog/fire-basics": page("Retirement planning basics | Example", "# Retirement planning basics\n\nFIRE means financial independence, retire early. A calculator helps."),
  "/blog/glossary/etf": page("ETF | Example", "# ETF\n\nAn exchange-traded fund."),
};

describe("createSearchSiteTool", () => {
  it("searches the sitemap's pages as Markdown and ranks pages with every word first, title matches above body ones", async () => {
    const { fetchImpl, calls } = createFetch(SITE);
    const tool = createSearchSiteTool({ fetchImpl });

    const result = await tool.execute({ query: "retirement calculator" });

    expect(result.isError).toBeUndefined();
    const answer = text(result);
    expect(answer.startsWith('2 pages match "retirement calculator" (4 pages searched).')).toBe(true);
    expect(answer.indexOf("Retirement planning basics | Example")).toBeLessThan(answer.indexOf("Pricing | Example"));
    expect(answer).toContain("/blog/fire-basics");
    expect(answer).toContain("The retirement calculator is free.");
    expect(answer).not.toContain("/blog/glossary/etf");
    expect(answer).not.toContain("Home | Example");
    expect(calls.find(({ path }) => path === "/pricing")).toEqual({ path: "/pricing", accept: "text/markdown", credentials: "omit" });
  });

  it("takes each sitemap URL as a path on the page's own origin", async () => {
    const { fetchImpl, calls } = createFetch(SITE);
    await createSearchSiteTool({ fetchImpl }).execute({ query: "fund" });
    expect(calls.map(({ path }) => path)).toEqual(["/sitemap.xml", "/", "/pricing", "/blog/fire-basics", "/blog/glossary/etf"]);
  });

  it("folds case and diacritics, the l with stroke included", async () => {
    const { fetchImpl } = createFetch({
      "/sitemap.xml": sitemap("/a"),
      "/a": page("Prices", `# Prices\n\nEvery plan costs 10 ${PRICE_UNIT} a month, ${SOURCE_WORD}: us.`),
    });
    const answer = text(await createSearchSiteTool({ fetchImpl }).execute({ query: "zlotych zrodlo" }));
    expect(answer).toContain("1 page matches");
    expect(answer).toContain(PRICE_UNIT);
  });

  it("answers at most `limit` pages", async () => {
    const { fetchImpl } = createFetch(SITE);
    const answer = text(await createSearchSiteTool({ fetchImpl }).execute({ query: "retirement", limit: 1 }));
    expect(answer).toContain("3 pages match");
    expect(answer).toContain("1. Retirement planning basics | Example");
    expect(answer).not.toContain("2. ");
  });

  it("answers a plain text when nothing matches", async () => {
    const { fetchImpl } = createFetch(SITE);
    const result = await createSearchSiteTool({ fetchImpl }).execute({ query: "mortgage" });
    expect(result).toEqual({ content: [{ type: "text", text: 'No page matches "mortgage" (4 pages searched).' }] });
  });

  it("rejects a query that is missing, empty or not a string", async () => {
    const { fetchImpl } = createFetch(SITE);
    const tool = createSearchSiteTool({ fetchImpl });
    for (const args of [undefined, {}, { query: "  " }, { query: 7 }]) {
      expect(await tool.execute(args)).toEqual({ content: [{ type: "text", text: "searchSite: query must be a non-empty string" }], isError: true });
    }
  });

  it("skips a page that fails and fails only when every page or the sitemap fails", async () => {
    const { fetchImpl } = createFetch({ ...SITE, "/pricing": 500 });
    const answer = text(await createSearchSiteTool({ fetchImpl }).execute({ query: "retirement" }));
    expect(answer).toContain('2 pages match "retirement" (3 of 4 pages searched; 1 failed).');

    const allFail = createFetch({ "/sitemap.xml": sitemap("/a"), "/a": 503 });
    expect(await createSearchSiteTool({ fetchImpl: allFail.fetchImpl }).execute({ query: "x" })).toEqual({
      content: [{ type: "text", text: "searchSite: no page could be read (/a: HTTP 503)" }],
      isError: true,
    });

    const noSitemap = createFetch({});
    expect(await createSearchSiteTool({ fetchImpl: noSitemap.fetchImpl }).execute({ query: "x" })).toEqual({
      content: [{ type: "text", text: "searchSite: /sitemap.xml: HTTP 404" }],
      isError: true,
    });
  });

  it("searches listed paths without a sitemap and caps the pages at `maxPages`", async () => {
    const { fetchImpl, calls } = createFetch(SITE);
    const listed = text(await createSearchSiteTool({ fetchImpl, pages: { paths: ["/pricing"] } }).execute({ query: "plan" }));
    expect(listed).toContain('1 page matches "plan" (1 page searched).');
    expect(calls.map(({ path }) => path)).toEqual(["/pricing"]);

    const capped = createFetch(SITE);
    const answer = text(await createSearchSiteTool({ fetchImpl: capped.fetchImpl, maxPages: 2 }).execute({ query: "retirement" }));
    expect(answer).toContain("(2 of 4 pages searched).");
    expect(capped.calls.map(({ path }) => path)).toEqual(["/sitemap.xml", "/", "/pricing"]);
  });

  it("reads the sitemap and each page once across calls, and retries a page that failed", async () => {
    const routes: Routes = { "/sitemap.xml": sitemap("/a", "/b"), "/a": page("A", "# A\n\nalpha"), "/b": 500 };
    const { fetchImpl, calls } = createFetch(routes);
    const tool = createSearchSiteTool({ fetchImpl });
    await tool.execute({ query: "alpha" });
    routes["/b"] = page("B", "# B\n\nalpha too");
    const answer = text(await tool.execute({ query: "alpha" }));
    expect(answer).toContain("2 pages match");
    expect(calls.map(({ path }) => path)).toEqual(["/sitemap.xml", "/a", "/b", "/b"]);
  });

  it("takes the first heading, else the path, as a page's title when the frontmatter has none", async () => {
    const { fetchImpl } = createFetch({ "/sitemap.xml": sitemap("/a", "/b"), "/a": "# Heading A\n\nbeta", "/b": "beta only" });
    const answer = text(await createSearchSiteTool({ fetchImpl }).execute({ query: "beta" }));
    expect(answer).toContain("Heading A");
    expect(answer).toContain("/b (/b)");
  });
});

const GLOSSARY_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "Glossary",
  hasDefinedTerm: [
    { "@type": "DefinedTerm", name: "ETF", description: "An exchange-traded fund.", url: "https://www.example.com/blog/glossary/etf" },
    { "@type": "DefinedTerm", name: "Safe withdrawal rate", description: "What you can take out each year.", url: "https://www.example.com/blog/glossary/swr" },
    { "@type": "DefinedTerm", name: "Withdrawal plan", description: "How you take money out.", url: "https://www.example.com/blog/glossary/withdrawal-plan" },
  ],
};

function glossaryPage(jsonLd: unknown): string {
  return `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body><main>Glossary</main></body></html>`;
}

const BLOG: Routes = {
  "/blog/glossary": glossaryPage(GLOSSARY_JSON_LD),
  "/blog/glossary/etf": page("ETF | Example", "# ETF\n\nAn exchange-traded fund holds a basket of assets."),
  "/blog/glossary/swr": page("Safe withdrawal rate | Example", "# Safe withdrawal rate\n\nAbout 4% a year."),
};

describe("createFindTermTool", () => {
  it("finds a term by its name and answers its page's Markdown", async () => {
    const { fetchImpl, calls } = createFetch(BLOG);
    const result = await createFindTermTool({ fetchImpl }).execute({ term: "etf" });
    expect(result).toEqual({ content: [{ type: "text", text: "ETF (/blog/glossary/etf)\n\n# ETF\n\nAn exchange-traded fund holds a basket of assets." }] });
    expect(calls[0]).toEqual({ path: "/blog/glossary", accept: "text/html", credentials: "omit" });
    expect(calls[1]).toEqual({ path: "/blog/glossary/etf", accept: "text/markdown", credentials: "omit" });
  });

  it("matches by the URL slug, then by a single partial match", async () => {
    const { fetchImpl } = createFetch(BLOG);
    const tool = createFindTermTool({ fetchImpl });
    expect(text(await tool.execute({ term: "SWR" }))).toContain("Safe withdrawal rate (/blog/glossary/swr)");
    expect(text(await tool.execute({ term: "safe withdrawal" }))).toContain("About 4% a year.");
  });

  it("lists the candidates when several terms match partly", async () => {
    const { fetchImpl } = createFetch(BLOG);
    expect(await createFindTermTool({ fetchImpl }).execute({ term: "withdrawal" })).toEqual({
      content: [
        {
          type: "text",
          text: 'No glossary term is exactly "withdrawal". Close terms:\n- Safe withdrawal rate (/blog/glossary/swr): What you can take out each year.\n- Withdrawal plan (/blog/glossary/withdrawal-plan): How you take money out.',
        },
      ],
    });
  });

  it("answers the description when the term's page cannot be read", async () => {
    const { fetchImpl } = createFetch(BLOG);
    const answer = text(await createFindTermTool({ fetchImpl }).execute({ term: "Withdrawal plan" }));
    expect(answer).toBe("Withdrawal plan (/blog/glossary/withdrawal-plan)\n\nHow you take money out.");
  });

  it("answers plain texts for no match and for a glossary without terms", async () => {
    const { fetchImpl } = createFetch(BLOG);
    expect(text(await createFindTermTool({ fetchImpl }).execute({ term: "bond" }))).toBe('No glossary term matches "bond".');
    const empty = createFetch({ "/terms": "<html><body><main>No terms yet.</main></body></html>" });
    expect(text(await createFindTermTool({ fetchImpl: empty.fetchImpl, glossary: "/terms" }).execute({ term: "bond" }))).toBe("The glossary has no terms.");
  });

  it("reads terms in a @graph and skips broken JSON-LD", async () => {
    const html = `<script type="application/ld+json">{broken</script>${glossaryPage({ "@graph": [{ "@type": "WebPage" }, GLOSSARY_JSON_LD] })}`;
    const { fetchImpl } = createFetch({ ...BLOG, "/blog/glossary": html });
    expect(text(await createFindTermTool({ fetchImpl }).execute({ term: "ETF" }))).toContain("exchange-traded fund holds");
  });

  it("fails on a glossary page error and on a bad term", async () => {
    const { fetchImpl } = createFetch({ "/blog/glossary": 500 });
    const tool = createFindTermTool({ fetchImpl });
    expect(await tool.execute({ term: "ETF" })).toEqual({ content: [{ type: "text", text: "findTerm: /blog/glossary: HTTP 500" }], isError: true });
    expect(await tool.execute({ term: "" })).toEqual({ content: [{ type: "text", text: "findTerm: term must be a non-empty string" }], isError: true });
  });

  it("reads the glossary page once across calls", async () => {
    const { fetchImpl, calls } = createFetch(BLOG);
    const tool = createFindTermTool({ fetchImpl });
    await tool.execute({ term: "ETF" });
    await tool.execute({ term: "SWR" });
    expect(calls.filter(({ path }) => path === "/blog/glossary")).toHaveLength(1);
  });
});

describe("as WebMCP tools", () => {
  it("have the issue's names, JSON Schema inputs and overridable names and descriptions", () => {
    const search = createSearchSiteTool();
    const find = createFindTermTool();
    expect(search.name).toBe("searchSite");
    expect(find.name).toBe("findTerm");
    expect(search.inputSchema).toMatchObject({ type: "object", required: ["query"], properties: { query: { type: "string" }, limit: { type: "integer" } } });
    expect(find.inputSchema).toMatchObject({ type: "object", required: ["term"], properties: { term: { type: "string" } } });
    expect(search.description.length).toBeGreaterThan(20);
    expect(find.description.length).toBeGreaterThan(20);
    expect(createSearchSiteTool({ name: "search_docs", description: "Searches the docs." })).toMatchObject({ name: "search_docs", description: "Searches the docs." });
    expect(createFindTermTool({ name: "define", description: "Defines a word." })).toMatchObject({ name: "define", description: "Defines a word." });
  });

  it("register through registerWebMcpTool", () => {
    const registered: RegisteredWebMcpTool[] = [];
    const modelContext: ModelContextLike = { registerTool: (tool) => registered.push(tool) };
    const controller = new AbortController();
    registerWebMcpTool(modelContext, createSearchSiteTool(), controller.signal);
    registerWebMcpTool(modelContext, createFindTermTool(), controller.signal);
    expect(registered.map(({ name }) => name)).toEqual(["searchSite", "findTerm"]);
  });
});
