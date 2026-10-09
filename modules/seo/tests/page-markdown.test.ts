// The proxy piece: a sitemap page asked for with `Accept: text/markdown` answers as Markdown.
import { defineSoftureConfig } from "@softure-ai/core";
import { seo, type SeoOptionsInput } from "@softure-ai/seo";
import { createPageMarkdown, PAGE_MARKDOWN_HEADER, type PageMarkdownOptions } from "@softure-ai/seo/proxy";
import { describe, expect, it, vi } from "vitest";

const SITE = "https://example.com";
const SELF = "http://127.0.0.1:4100";
const MARKDOWN = "text/markdown, text/html;q=0.9";
const PRICING_HTML =
  '<!doctype html><html><head><title>Pricing</title><meta name="description" content="Plans"></head>' +
  '<body><nav><a href="/">Home</a></nav><main><h1>Pricing</h1><p>See <a href="/terms">terms</a>.</p></main></body></html>';
const PRICING_MARKDOWN = `---\ntitle: "Pricing"\ndescription: "Plans"\nurl: "${SITE}/pricing"\n---\n\n# Pricing\n\nSee [terms](${SITE}/terms).\n`;

function buildConfig(options: SeoOptionsInput = {}) {
  return defineSoftureConfig({
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "https://app.example.com",
    modules: [seo({ origin: SITE, sitemap: { entries: [{ path: "/" }, { path: "/pricing" }] }, ...options })],
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

function setup(seoOptions: SeoOptionsInput = {}, options: Partial<PageMarkdownOptions> = {}) {
  const fetchPage = vi.fn<typeof fetch>(() => Promise.resolve(htmlResponse(PRICING_HTML)));
  const onError = vi.fn<(message: string) => void>();
  const answer = createPageMarkdown(buildConfig(seoOptions), { selfOrigin: SELF, fetch: fetchPage, onError, ...options });
  return { answer, fetchPage, onError };
}

function request(path: string, init: { accept?: string; method?: string; headers?: Record<string, string> } = {}): Request {
  const headers = new Headers(init.headers);
  if (init.accept !== undefined) headers.set("accept", init.accept);
  return new Request(new URL(path, "https://app.example.com"), { method: init.method ?? "GET", headers });
}

describe("createPageMarkdown", () => {
  it("answers a sitemap page asked for as Markdown with its main element", async () => {
    const { answer } = setup();
    const response = await answer(request("/pricing", { accept: MARKDOWN }));
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe(PRICING_MARKDOWN);
    expect(Object.fromEntries(response?.headers ?? [])).toEqual({
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept",
      "cache-control": "private, max-age=0, must-revalidate",
      "x-markdown-tokens": String(Math.ceil(PRICING_MARKDOWN.length / 4)),
    });
  });

  it("renders the page anonymously on the app's own server, without the query or the visitor's cookies", async () => {
    const { answer, fetchPage } = setup();
    await answer(request("/pricing?tag=abc", { accept: MARKDOWN, headers: { cookie: "session=secret", authorization: "Bearer x" } }));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    const [url, init] = fetchPage.mock.calls[0] ?? [];
    expect(url).toEqual(new URL(`${SELF}/pricing`));
    expect(init).toEqual({ headers: { accept: "text/html", [PAGE_MARKDOWN_HEADER]: "1" }, redirect: "manual", cache: "no-store" });
  });

  it("answers HEAD with the headers and no body", async () => {
    const { answer } = setup();
    const response = await answer(request("/pricing", { accept: MARKDOWN, method: "HEAD" }));
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response?.body).toBeNull();
  });

  it("leaves a browser's request to the page without rendering anything", async () => {
    const { answer, fetchPage } = setup();
    expect(await answer(request("/pricing", { accept: "text/html,*/*;q=0.8" }))).toBeNull();
    expect(await answer(request("/pricing"))).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("leaves a POST to the page", async () => {
    const { answer, fetchPage } = setup();
    expect(await answer(request("/pricing", { accept: MARKDOWN, method: "POST" }))).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("never answers its own internal render", async () => {
    const { answer, fetchPage } = setup();
    expect(await answer(request("/pricing", { accept: MARKDOWN, headers: { [PAGE_MARKDOWN_HEADER]: "1" } }))).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("leaves a path outside the sitemap to the page", async () => {
    const { answer, fetchPage } = setup();
    expect(await answer(request("/account", { accept: MARKDOWN }))).toBeNull();
    expect(await answer(request("/pricing/extra", { accept: MARKDOWN }))).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("never renders a path that reads as another host, whatever the predicate says", async () => {
    const { answer, fetchPage, onError } = setup({}, { paths: () => true });
    expect(await answer(request("https://app.example.com//evil.example/x", { accept: MARKDOWN }))).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("matches the path by canonical URL, so the trailing slash rule applies", async () => {
    const { answer } = setup({ canonical: { trailingSlash: true } });
    expect((await answer(request("/pricing", { accept: MARKDOWN })))?.status).toBe(200);
    expect((await answer(request("/pricing/", { accept: MARKDOWN })))?.status).toBe(200);
  });

  it("answers a contributor's page too", async () => {
    const { answer } = setup({ sitemap: { entries: [], contributors: [() => [{ path: "/pricing" }]] } });
    expect((await answer(request("/pricing", { accept: MARKDOWN })))?.status).toBe(200);
  });

  it("reads the sitemap once per cache period, once for concurrent requests", async () => {
    let clock = 0;
    const contributor = vi.fn(() => Promise.resolve([{ path: "/pricing" }]));
    const { answer } = setup({ sitemap: { contributors: [contributor] } }, { cacheSeconds: 60, now: () => clock });
    await Promise.all([answer(request("/pricing", { accept: MARKDOWN })), answer(request("/", { accept: MARKDOWN }))]);
    expect(contributor).toHaveBeenCalledTimes(1);
    clock = 59_999;
    await answer(request("/pricing", { accept: MARKDOWN }));
    expect(contributor).toHaveBeenCalledTimes(1);
    clock = 60_000;
    await answer(request("/pricing", { accept: MARKDOWN }));
    expect(contributor).toHaveBeenCalledTimes(2);
  });

  it("reads the sitemap on every request with cacheSeconds 0", async () => {
    const contributor = vi.fn(() => [{ path: "/pricing" }]);
    const { answer } = setup({ sitemap: { contributors: [contributor] } }, { cacheSeconds: 0 });
    await answer(request("/pricing", { accept: MARKDOWN }));
    await answer(request("/pricing", { accept: MARKDOWN }));
    expect(contributor).toHaveBeenCalledTimes(2);
  });

  it("refuses a negative cache period", () => {
    expect(() => createPageMarkdown(buildConfig(), { cacheSeconds: -1 })).toThrow("cacheSeconds must be 0 or more, got -1");
  });

  it("asks the app's predicate instead of the sitemap when given", async () => {
    const { answer } = setup({}, { paths: (pathname) => pathname === "/about" });
    expect((await answer(request("/about", { accept: MARKDOWN })))?.status).toBe(200);
    expect(await answer(request("/pricing", { accept: MARKDOWN }))).toBeNull();
  });

  it("leaves the page to answer when the predicate throws, and reports it", async () => {
    const { answer, onError } = setup({}, { paths: () => { throw new Error("db down"); } });
    expect(await answer(request("/pricing", { accept: MARKDOWN }))).toBeNull();
    expect(onError).toHaveBeenCalledWith("@softure-ai/seo: deciding whether /pricing has a Markdown version failed: db down");
  });

  it.each([
    ["an error page", htmlResponse("<main>Error</main>", 500)],
    ["a page that is not HTML", new Response("{}", { status: 200, headers: { "content-type": "application/json" } })],
  ])("leaves %s to the page itself", async (_name, page) => {
    const { answer, onError } = setup({}, { fetch: () => Promise.resolve(page) });
    expect(await answer(request("/pricing", { accept: MARKDOWN }))).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it.each([
    ["a relative Location", "/plans?period=year", `${SITE}/plans?period=year`],
    ["a Location on the app's own server", `${SELF}/plans`, `${SITE}/plans`],
    ["a Location on another site", "https://other.org/plans", "https://other.org/plans"],
  ])("answers a redirect with %s on the public origin, so the agent follows it asking for Markdown again", async (_name, location, expected) => {
    for (const status of [301, 302, 303, 307, 308]) {
      const { answer, onError } = setup({}, { fetch: () => Promise.resolve(new Response(null, { status, headers: { location } })) });
      const response = await answer(request("/pricing", { accept: MARKDOWN }));
      expect(response?.status).toBe(status);
      expect(Object.fromEntries(response?.headers ?? [])).toEqual({ location: expected, vary: "Accept", "cache-control": "private, max-age=0, must-revalidate" });
      expect(await response?.text()).toBe("");
      expect(onError).not.toHaveBeenCalled();
    }
  });

  it("leaves a redirect without a Location to the page", async () => {
    const { answer } = setup({}, { fetch: () => Promise.resolve(new Response(null, { status: 302 })) });
    expect(await answer(request("/pricing", { accept: MARKDOWN }))).toBeNull();
  });

  it.each([404, 410])("answers a %i page with its main element as Markdown and the same status", async (status) => {
    const html = "<html><head><title>Not found</title></head><body><main><h1>Not found</h1><p>Try <a href=\"/\">home</a>.</p></main></body></html>";
    const { answer } = setup({}, { fetch: () => Promise.resolve(htmlResponse(html, status)) });
    const response = await answer(request("/pricing", { accept: MARKDOWN }));
    expect(response?.status).toBe(status);
    expect(response?.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(await response?.text()).toBe(`---\ntitle: "Not found"\nurl: "${SITE}/pricing"\n---\n\n# Not found\n\nTry [home](${SITE}/).\n`);
  });

  it("leaves the page to answer when the render fails, and reports it", async () => {
    const { answer, onError } = setup({}, { fetch: () => Promise.reject(new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED 127.0.0.1:4100") })) });
    expect(await answer(request("/pricing", { accept: MARKDOWN }))).toBeNull();
    expect(onError).toHaveBeenCalledWith("@softure-ai/seo: rendering /pricing as Markdown failed: fetch failed (connect ECONNREFUSED 127.0.0.1:4100)");
  });

  it("leaves a page without a main element to the page, and reports it", async () => {
    const { answer, onError } = setup({}, { fetch: () => Promise.resolve(htmlResponse("<body><p>x</p></body>")) });
    expect(await answer(request("/pricing", { accept: MARKDOWN }))).toBeNull();
    expect(onError).toHaveBeenCalledWith("@softure-ai/seo: page /pricing has no main element, so it has no Markdown version");
  });

  it("drops the app's selectors and converts another root when asked", async () => {
    const html = '<html><body><article><p>Body</p><div class="toc">Contents</div></article></body></html>';
    const { answer } = setup({}, { fetch: () => Promise.resolve(htmlResponse(html)), root: "article", remove: [".toc"] });
    expect(await (await answer(request("/", { accept: MARKDOWN })))?.text()).toBe(`---\nurl: "${SITE}/"\n---\n\nBody\n`);
  });

  it("renders on the PORT loopback address by default", async () => {
    vi.stubEnv("PORT", "3999");
    try {
      const fetchPage = vi.fn<typeof fetch>(() => Promise.resolve(htmlResponse(PRICING_HTML)));
      await createPageMarkdown(buildConfig(), { fetch: fetchPage })(request("/pricing", { accept: MARKDOWN }));
      expect(fetchPage.mock.calls[0]?.[0]).toEqual(new URL("http://127.0.0.1:3999/pricing"));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses a config without the seo module", () => {
    const config = defineSoftureConfig({ locale: "en", timezone: "Europe/Warsaw", appOrigin: SITE, modules: [] });
    expect(() => createPageMarkdown(config)).toThrow("the seo module is not enabled");
  });
});
