// @softure-ai/blog on the built app, over the fixture texts of content/blog (npm run blog:fixtures):
// the listing, an article with its slots, JSON-LD and "read next", the glossary, the method page, the OG
// card, the feed and the sitemap entries, 301 from an old slug, 410 for withdrawn texts and 404 for a draft.
import { expect, test } from "@playwright/test";

test("the listing groups the articles by cluster with the pillar first", async ({ page }) => {
  const response = await page.goto("/blog");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  const cluster = page.locator("#cluster-investing-basics");
  await expect(cluster.getByRole("heading", { level: 2 })).toHaveText("Investing basics");
  await expect(cluster.locator(".blog-card").first()).toHaveAttribute("data-slug", "index-funds");
  await expect(cluster.locator(".blog-card-lead")).toContainText("Start here");
  await expect(cluster.getByRole("link", { name: "Bonds in plain words" })).toHaveAttribute("href", "/blog/bond-basics");
  await expect(page.getByRole("link", { name: "How big an emergency fund should be" })).toBeVisible();
  for (const hidden of ["Last year's tax rules", "A text still being written"]) {
    await expect(page.getByText(hidden)).toHaveCount(0);
  }
  await expect(page.getByTestId("blog-cta")).toBeVisible();
  await expect(page.getByRole("link", { name: "Glossary", exact: true })).toHaveAttribute("href", "/blog/glossary");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/blog$/);
});

test("an article shows its dates, summary, contents, glossary link, FAQ, sources and the app's slots", async ({ page, baseURL }) => {
  const response = await page.goto("/blog/index-funds");
  expect(response?.status()).toBe(200);

  await expect(page).toHaveTitle("Index funds in plain words | SOFTURE example");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Index funds in plain words");
  await expect(page.locator(".blog-dates time").first()).toHaveAttribute("datetime", "2026-09-15");
  await expect(page.getByRole("complementary", { name: "In short" })).toContainText("costs little and follows the market");
  await expect(page.getByRole("navigation", { name: "In this text" }).getByRole("link", { name: "What it costs" })).toHaveAttribute("href", "#what-it-costs");
  await expect(page.locator(".blog-body a.blog-term")).toHaveAttribute("href", "/blog/glossary/expense-ratio");
  await expect(page.locator(".blog-faq dt").first()).toHaveText("Is an index fund safe?");
  await expect(page.getByRole("link", { name: "Example fund factsheet" })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByText("SOFTURE example editorial team")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Disclaimer" })).toContainText("not financial advice");
  await expect(page.getByTestId("blog-cta")).toBeVisible();
  await expect(page.locator('input[name="placement"]')).toHaveValue("blog");

  const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}") as { "@graph": { "@type": string; url?: string }[] };
  expect(jsonLd["@graph"].map((node) => node["@type"])).toEqual(["BlogPosting", "BreadcrumbList", "FAQPage"]);
  expect(jsonLd["@graph"][0]?.url).toBe(`${String(baseURL)}/blog/index-funds`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/blog\/index-funds\/opengraph-image/);
});

test("an article ends with \"read next\": its cluster first, then the other texts, newest first", async ({ page }) => {
  await page.goto("/blog/index-funds");
  const related = page.getByRole("region", { name: "Read next" });
  await expect(related.getByRole("heading", { level: 3 })).toHaveText(["Bonds in plain words", "How big an emergency fund should be", "How much of your income to save"]);
  await expect(related.getByRole("link", { name: "Bonds in plain words" })).toHaveAttribute("href", "/blog/bond-basics");
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute("href", /\/blog\/rss\.xml$/);
});

test("the feed lists the published articles and terms, newest first, and nothing else", async ({ request, baseURL }) => {
  const response = await request.get("/blog/rss.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/rss+xml; charset=utf-8");
  const xml = await response.text();

  expect(xml).toContain(`<atom:link href="${String(baseURL)}/blog/rss.xml" rel="self" type="application/rss+xml"/>`);
  const links = [...xml.matchAll(/<item>\s*<title>[^<]*<\/title>\s*<link>([^<]*)<\/link>/g)].map((match) => match[1]?.replace(String(baseURL), ""));
  expect(links).toEqual(["/blog/bond-basics", "/blog/index-funds", "/blog/glossary/expense-ratio", "/blog/emergency-fund", "/blog/saving-rate"]);
  expect(xml).toContain("<category>Investing basics</category>");
});

test("the sitemap lists the blog's texts with their dates, and no withdrawn text or draft", async ({ request, baseURL }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const entries = new Map([...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => [/<loc>([^<]*)<\/loc>/.exec(match[1] ?? "")?.[1]?.replace(String(baseURL), ""), match[1] ?? ""]));
  const blogPaths = [...entries.keys()].filter((path) => path?.startsWith("/blog"));
  expect(blogPaths).toEqual([
    "/blog",
    "/blog/bond-basics",
    "/blog/index-funds",
    "/blog/emergency-fund",
    "/blog/saving-rate",
    "/blog/glossary",
    "/blog/glossary/expense-ratio",
    "/blog/how-we-write",
  ]);
  for (const path of blogPaths.filter((path) => path !== "/blog/how-we-write")) expect(entries.get(path), path).toMatch(/<lastmod>2026-/);
  // The method page has no content date, so it has no <lastmod> rather than an invented one.
  expect(entries.get("/blog/how-we-write")).not.toContain("<lastmod>");
});

test("the article's OG card is a PNG", async ({ request }) => {
  const response = await request.get("/blog/index-funds/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect((await response.body()).subarray(1, 4).toString()).toBe("PNG");
});

test("the glossary lists its terms and a term lists the articles that explain it", async ({ page }) => {
  await page.goto("/blog/glossary");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Glossary");
  await expect(page.getByRole("link", { name: "Expense ratio" })).toHaveAttribute("href", "/blog/glossary/expense-ratio");
  await expect(page.getByText("Retired term")).toHaveCount(0);

  const response = await page.goto("/blog/glossary/expense-ratio");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Expense ratio");
  await expect(page.getByRole("region", { name: "Explained in these texts" }).getByRole("link", { name: "Index funds in plain words" })).toHaveAttribute("href", "/blog/index-funds");
  const jsonLd = (await page.locator('script[type="application/ld+json"]').textContent()) ?? "";
  expect(jsonLd).toContain('"@type":"DefinedTerm"');
});

test("the method page explains how the texts are made", async ({ page }) => {
  const response = await page.goto("/blog/how-we-write");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How our texts are made");
  await expect(page.getByRole("heading", { name: "Checks before publishing" })).toBeVisible();
});

// Next writes a same-origin Location as a path.
test("an old slug moves to the current address with a 301 that keeps the query", async ({ request }) => {
  const response = await request.get("/blog/how-much-to-save?z=newsletter", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/blog/saving-rate?z=newsletter");

  const term = await request.get("/blog/expense-ratio", { maxRedirects: 0 });
  expect(term.status()).toBe(301);
  expect(term.headers().location).toBe("/blog/glossary/expense-ratio");
});

test("a withdrawn article and a withdrawn term answer 410 with a way back to the blog", async ({ page }) => {
  for (const path of ["/blog/outdated-tax-rules", "/blog/glossary/retired-term"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(410);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This text has been withdrawn");
    await expect(page.getByRole("link", { name: "See the other texts on the blog" })).toHaveAttribute("href", "/blog");
  }
});

test("a draft and an unknown slug answer 404", async ({ request }) => {
  for (const path of ["/blog/upcoming", "/blog/no-such-text", "/blog/glossary/no-such-term"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
