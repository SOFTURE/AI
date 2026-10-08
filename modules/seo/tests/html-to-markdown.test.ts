// A rendered page to Markdown: the main element only, without navigation and controls.
import { htmlToMarkdown } from "@softure-ai/seo/server";
import { describe, expect, it } from "vitest";

const ORIGIN = "https://example.com";

function page(main: string, head = "<title>Pricing</title>"): string {
  return `<!doctype html><html><head>${head}</head><body><header><a href="/">Home</a></header>${main}<footer>Footer</footer></body></html>`;
}

describe("htmlToMarkdown", () => {
  it("converts the main element with a frontmatter of title, description and URL", () => {
    const html = page(
      "<main><h1>Pricing</h1><p>One plan, <strong>no tiers</strong>.</p></main>",
      '<title>Pricing | Example</title><meta name="description" content="What it costs">',
    );
    expect(htmlToMarkdown(html, { origin: ORIGIN, url: `${ORIGIN}/pricing` })).toBe(
      ['---', 'title: "Pricing | Example"', 'description: "What it costs"', `url: "${ORIGIN}/pricing"`, "---", "", "# Pricing", "", "One plan, **no tiers**.", ""].join("\n"),
    );
  });

  it("takes the URL from the page's canonical link over the given one", () => {
    const html = page("<main><p>Text</p></main>", '<title>T</title><link rel="canonical" href="/pricing">');
    expect(htmlToMarkdown(html, { origin: ORIGIN, url: `${ORIGIN}/pricing?tag=x` })).toContain(`url: "${ORIGIN}/pricing"`);
  });

  it("quotes frontmatter values so a colon or a quote cannot break the YAML", () => {
    const html = page("<main><p>Text</p></main>", '<title>Plans: "Pro"</title>');
    expect(htmlToMarkdown(html, { url: `${ORIGIN}/` })).toContain('title: "Plans: \\"Pro\\""');
  });

  it("leaves out title and description the page does not have", () => {
    const html = "<html><body><main><p>Text</p></main></body></html>";
    expect(htmlToMarkdown(html, { url: `${ORIGIN}/` })).toBe(`---\nurl: "${ORIGIN}/"\n---\n\nText\n`);
  });

  it("drops navigation, controls, graphics and hidden content inside main", () => {
    const html = page(
      [
        "<main>",
        '<nav><a href="/a">Menu</a></nav>',
        "<h1>Title</h1>",
        "<button>Copy</button>",
        "<form><input name=q></form>",
        "<svg><text>chart</text></svg>",
        "<script>track()</script>",
        "<p hidden>Hidden</p>",
        '<p aria-hidden="true">Decor</p>',
        "<p>Kept</p>",
        "</main>",
      ].join(""),
    );
    expect(htmlToMarkdown(html, { url: `${ORIGIN}/`, frontmatter: false })).toBe("# Title\n\nKept\n");
  });

  it("drops the app's own selectors too", () => {
    const html = page('<main><p>Kept</p><a class="back" href="#ref">↩</a><div class="toc">Contents</div></main>');
    expect(htmlToMarkdown(html, { frontmatter: false, remove: ["a.back", ".toc"] })).toBe("Kept\n");
  });

  it("makes root-relative links and images absolute on the origin", () => {
    const html = page('<main><p><a href="/terms">Terms</a> <a href="https://other.org/x">Other</a> <a href="#s">Anchor</a> <img src="/og.png" alt="Card"></p></main>');
    expect(htmlToMarkdown(html, { origin: ORIGIN, frontmatter: false })).toBe(
      `[Terms](${ORIGIN}/terms) [Other](https://other.org/x) [Anchor](#s) ![Card](${ORIGIN}/og.png)\n`,
    );
  });

  it("leaves protocol-relative links alone", () => {
    const html = page('<main><a href="//cdn.example.org/a">CDN</a></main>');
    expect(htmlToMarkdown(html, { origin: ORIGIN, frontmatter: false })).toBe("[CDN](//cdn.example.org/a)\n");
  });

  it("returns null when the page has no main element", () => {
    expect(htmlToMarkdown("<html><body><p>Only chrome</p></body></html>", { url: `${ORIGIN}/` })).toBeNull();
  });

  it("uses another root element when asked", () => {
    const html = '<html><body><article id="content"><p>Body</p></article></body></html>';
    expect(htmlToMarkdown(html, { root: "#content", frontmatter: false })).toBe("Body\n");
  });

  it("converts a whole fragment with root null", () => {
    expect(htmlToMarkdown("<figure><figcaption>Chart</figcaption><svg></svg><table><tr><th>Year</th></tr><tr><td>2026</td></tr></table></figure>", { root: null, frontmatter: false })).toBe(
      "Chart\n\n| Year |\n| ---- |\n| 2026 |\n",
    );
  });

  it("needs a URL or a canonical link for the frontmatter", () => {
    expect(() => htmlToMarkdown("<main><p>x</p></main>")).toThrow(/htmlToMarkdown: .*url/);
  });
});
