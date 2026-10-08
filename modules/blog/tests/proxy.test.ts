// The proxy piece over a published PGlite blog: 301 from an old slug and between kinds, 410 for
// withdrawn texts, nothing for anything else.
import { createBlogRedirects } from "@softure-ai/blog/proxy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPublishedBlog } from "./next/support.js";
import { createConfig, type TestBlog } from "./support.js";

let test: TestBlog;

beforeEach(async () => {
  test = await createPublishedBlog();
});
afterEach(async () => {
  await test.database.close();
});

function createPiece() {
  return createBlogRedirects(test.config, { getContext: () => Promise.resolve(test.ctx) });
}

const get = (path: string, method = "GET") => new Request(`https://app.example.com${path}`, { method });

describe("blog redirects", () => {
  it("moves an old slug to the current address with a 301, keeping the query", async () => {
    const response = await createPiece()(get("/blog/renamed-before?z=newsletter"));
    expect(response?.status).toBe(301);
    expect(response?.headers.get("location")).toBe("https://app.example.com/blog/renamed-after?z=newsletter");
  });

  it("moves a term asked for at the article path to the glossary", async () => {
    const response = await createPiece()(get("/blog/expense-ratio"));
    expect(response?.status).toBe(301);
    expect(response?.headers.get("location")).toBe("https://app.example.com/blog/glossary/expense-ratio");
  });

  it("answers 410 with the module's page for a withdrawn article and a withdrawn term", async () => {
    const piece = createPiece();
    for (const path of ["/blog/stale", "/blog/glossary/old-term"]) {
      const response = await piece(get(path));
      expect(response?.status, path).toBe(410);
      expect(response?.headers.get("content-type")).toBe("text/html; charset=utf-8");
      const html = (await response?.text()) ?? "";
      expect(html).toContain("<h1>This text has been withdrawn</h1>");
      expect(html).toContain('<a href="/blog">See the other texts on the blog</a>');
    }
    expect(await (await piece(get("/blog/stale", "HEAD")))?.text()).toBe("");
  });

  it("adds the app's links to the 410 page, labelled in the app's locale", async () => {
    await test.database.close();
    test = await createPublishedBlog({ gonePage: { links: [{ href: "/calculator", label: { en: "Try the calculator", pl: "Kalkulator" } }] } });
    const html = (await (await createPiece()(get("/blog/stale")))?.text()) ?? "";
    expect(html).toContain('<a href="/blog">See the other texts on the blog</a></p>\n<ul>\n<li><a href="/calculator">Try the calculator</a></li>\n</ul>');
  });

  it("answers 410 with the app's own body when it renders one", async () => {
    await test.database.close();
    const inputs: unknown[] = [];
    test = await createPublishedBlog({
      gonePage: {
        links: [{ href: "https://example.com/join", label: { en: "Join" } }],
        render: (input) => {
          inputs.push(input);
          return `<!doctype html><title>${input.copy.title}</title><a href="${input.indexPath}">back</a>`;
        },
      },
    });
    const response = await createPiece()(get("/blog/glossary/old-term"));
    expect(response?.status).toBe(410);
    expect(response?.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response?.text()).toBe('<!doctype html><title>Text withdrawn</title><a href="/blog">back</a>');
    expect(inputs).toEqual([
      {
        copy: { title: "Text withdrawn", heading: "This text has been withdrawn", body: "We took it down because it was no longer current or correct.", link: "See the other texts on the blog" },
        lang: "en",
        indexPath: "/blog",
        links: [{ href: "https://example.com/join", label: "Join" }],
      },
    ]);
  });

  it("refuses a 410 link with another scheme at startup", () => {
    for (const href of ["javascript:alert(1)", "//evil.example", "http://example.com/"]) {
      expect(() => createConfig({ gonePage: { links: [{ href, label: { en: "x" } }] } }), href).toThrow(/gonePage/);
    }
  });

  it("leaves published texts, drafts, unknown slugs, static pages and other paths to the app", async () => {
    const piece = createPiece();
    for (const path of ["/blog/index-funds", "/blog/glossary/expense-ratio", "/blog/draft", "/blog/missing", "/blog", "/blog/glossary", "/blog/how-we-write", "/blog/stale/opengraph-image", "/pricing"]) {
      expect(await piece(get(path)), path).toBeNull();
    }
    expect(await piece(get("/blog/stale", "POST"))).toBeNull();
  });

  it("passes requests on when the database fails", async () => {
    const errors: string[] = [];
    const piece = createBlogRedirects(test.config, { getContext: () => Promise.reject(new Error("connection refused")), onError: (message) => errors.push(message) });
    expect(await piece(get("/blog/stale"))).toBeNull();
    expect(errors).toEqual(['@softure-ai/blog proxy: lookup of the article "stale" failed: connection refused']);
  });
});
