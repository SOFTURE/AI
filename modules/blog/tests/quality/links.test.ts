// Internal link targets from the app folder and the content, and the network check of external links
// (FIRE `src/lib/blog/quality/links.test.ts`, with generic paths).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkExternalLinks, createInternalLinkResolver, findAppDir, readContentFolder, readPublishedContent, type FetchLike } from "@softure-ai/blog/server";
import { afterAll, describe, expect, it } from "vitest";

const root = mkdtempSync(join(tmpdir(), "blog-links-"));
const touch = (file: string, content = "") => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};
touch("src/app/page.tsx");
touch("src/app/calculator/page.tsx");
touch("src/app/calculator/counter/route.ts");
touch("src/app/(public)/pricing/page.tsx");
touch("src/app/(app)/dashboard/page.tsx");
touch("src/app/api/unsubscribe/route.ts");
touch("src/app/_components/page.tsx");
touch("src/app/blog/[slug]/page.tsx");
touch("src/app/blog/how-we-write/page.tsx");
touch("src/app/blog/glossary/page.tsx");
touch("src/app/blog/glossary/[slug]/page.tsx");
touch("content/blog/index-funds.md", "---\nid: index-funds\nstatus: published\n---\n");
touch("content/blog/expense-ratio.md", "---\nid: expense-ratio\nkind: term  # a glossary entry\nstatus: published\n---\n");
touch("content/blog/bonds.md", "---\nid: bonds\nstatus: draft\n---\n");
touch("content/blog/README.md", "---\nstatus: published\n---\n");
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("createInternalLinkResolver", () => {
  const exists = createInternalLinkResolver({
    appDir: findAppDir(root, undefined),
    privateRouteSegments: ["api", "(app)"],
    paths: { articles: "/blog", terms: "/blog/glossary" },
    content: readPublishedContent(readContentFolder(join(root, "content/blog"))),
  });

  it.each([
    ["/"],
    ["/calculator"],
    ["/calculator/"],
    ["/calculator/counter"],
    ["/pricing"],
    ["/blog/index-funds"],
    ["/blog/how-we-write"],
    ["/blog/glossary"],
    ["/blog/glossary/expense-ratio"],
  ])("finds %s", (pathname) => {
    expect(exists(pathname)).toBe(true);
  });

  it.each([
    ["/dashboard", "behind a login"],
    ["/api/unsubscribe", "an API, not a page"],
    ["/_components", "a private folder"],
    ["/blog/missing", "the dynamic route without an article file"],
    ["/blog/bonds", "a draft reaches no reader"],
    ["/blog/glossary/bonds", "a term without a file"],
    ["/blog/glossary/index-funds", "an article is not a term"],
    ["/blog/expense-ratio", "a term lives under the glossary path"],
    ["/blog/readme", "README.md is not content"],
    ["/calculatorr", "a typo"],
  ])("rejects %s (%s)", (pathname) => {
    expect(exists(pathname)).toBe(false);
  });

  it("falls back to app/ and then to content only", () => {
    expect(findAppDir(join(root, "content"), undefined)).toBeNull();
    const contentOnly = createInternalLinkResolver({ appDir: null, privateRouteSegments: [], paths: { articles: "/blog", terms: "/blog/glossary" }, content: new Map([["index-funds", "article"]]) });
    expect(contentOnly("/blog/index-funds")).toBe(true);
    expect(contentOnly("/calculator")).toBe(false);
  });
});

describe("checkExternalLinks", () => {
  const statuses: Record<string, Record<string, number>> = {
    "https://ok.example/": { HEAD: 200 },
    "https://head-refused.example/": { HEAD: 405, GET: 200 },
    "https://gone.example/": { HEAD: 404, GET: 404 },
  };
  const calls: string[] = [];
  const fakeFetch: FetchLike = (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (url === "https://down.example/") return Promise.reject(new Error("ECONNREFUSED"));
    return Promise.resolve({ status: statuses[url]?.[init.method] ?? 500 });
  };

  it("passes 2xx, retries a refused HEAD with GET and reports each dead link once", async () => {
    const findings = await checkExternalLinks(
      [
        { url: "https://ok.example/", line: 1 },
        { url: "https://head-refused.example/", line: 2 },
        { url: "https://gone.example/", line: 3 },
        { url: "https://gone.example/", line: 9 },
        { url: "https://down.example/", line: 4 },
      ],
      fakeFetch,
    );
    expect(findings).toEqual([
      { rule: "external-link-dead", severity: "error", message: "an external link does not answer 2xx (HTTP 404): https://gone.example/", line: 3 },
      { rule: "external-link-dead", severity: "error", message: "an external link does not answer 2xx (ECONNREFUSED): https://down.example/", line: 4 },
    ]);
    expect(calls.filter((call) => call.includes("gone"))).toEqual(["HEAD https://gone.example/", "GET https://gone.example/"]);
  });
});
