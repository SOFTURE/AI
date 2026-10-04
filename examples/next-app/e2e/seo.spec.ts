// @softure-ai/seo on the built app: robots.txt, sitemap.xml and the IndexNow key file, and the
// htmlLimitedBots list that hands AI crawlers the metadata in <head>.
import { expect, test } from "@playwright/test";
import { EXAMPLE_INDEXNOW_KEY } from "../softure.config.ts";

const PRIVATE_PATHS = ["/account", "/admin", "/api", "/switches"];
const GPTBOT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.3; +https://openai.com/gptbot";

/** The groups of a robots.txt: user agents and their rules. */
function parseRobotsGroups(text: string): { agents: string[]; disallow: string[]; allow: string[] }[] {
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let current: (typeof groups)[number] | undefined;
  for (const line of text.split("\n")) {
    const [field = "", ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const key = field.trim().toLowerCase();
    if (key === "user-agent") {
      if (current === undefined || current.allow.length > 0 || current.disallow.length > 0) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value);
    } else if (key === "allow" && current !== undefined) {
      current.allow.push(value);
    } else if (key === "disallow" && current !== undefined) {
      current.disallow.push(value);
    }
  }
  return groups;
}

test("robots.txt names the AI crawlers, closes the private paths in every group and points at the sitemap", async ({ request, baseURL }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const text = await response.text();

  const groups = parseRobotsGroups(text);
  expect(groups.map((group) => group.agents.length > 1 ? "named" : group.agents[0])).toEqual(["*", "named"]);
  for (const agent of ["GPTBot", "ClaudeBot", "OAI-SearchBot", "Claude-User", "PerplexityBot", "Google-Extended"]) {
    expect(groups[1]?.agents, agent).toContain(agent);
  }
  for (const group of groups) {
    expect(group.allow, group.agents.join(",")).toEqual(["/"]);
    expect(group.disallow, group.agents.join(",")).toEqual(PRIVATE_PATHS);
  }
  expect(text).toContain(`Sitemap: ${String(baseURL)}/sitemap.xml`);
});

test("sitemap.xml lists the public pages on the app's origin, and no private path", async ({ request, baseURL }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();

  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1] ?? "");
  const urls = entries.map((entry) => /<loc>([^<]*)<\/loc>/.exec(entry)?.[1]);
  // The app's own pages first; the blog's contributor follows (e2e/blog.spec.ts).
  expect(urls.slice(0, 4)).toEqual([`${String(baseURL)}/`, `${String(baseURL)}/pricing`, `${String(baseURL)}/legal/terms`, `${String(baseURL)}/legal/privacy`]);
  expect(urls.slice(4).every((url) => url?.startsWith(`${String(baseURL)}/blog`))).toBe(true);
  for (const path of PRIVATE_PATHS) expect(urls.some((url) => url?.startsWith(`${String(baseURL)}${path}`)), path).toBe(false);
  // No invented dates: the example gives its own pages none, so they have no <lastmod>.
  for (const entry of entries.slice(0, 4)) expect(entry).not.toContain("<lastmod>");
});

test("the IndexNow key file answers the key as plain text", async ({ request }) => {
  const response = await request.get("/indexnow-key.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  expect(await response.text()).toBe(EXAMPLE_INDEXNOW_KEY);
});

test("an AI crawler gets the page title in <head>", async ({ request }) => {
  const response = await request.get("/pricing", { headers: { "user-agent": GPTBOT } });
  expect(response.status()).toBe(200);
  const html = await response.text();
  const head = html.slice(0, html.indexOf("</head>"));
  expect(head).toMatch(/<title>[^<]+<\/title>/);
});
