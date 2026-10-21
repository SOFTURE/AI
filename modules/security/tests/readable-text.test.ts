// HTML to readable text: fixtures shaped like real pages (a news article, a video page, a repository page) and the
// rules one by one.
import { readFileSync } from "node:fs";
import { htmlToReadableText } from "@softure-ai/security/server";
import { describe, expect, it } from "vitest";

function readFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/pages/${name}.html`, import.meta.url), "utf8");
}

describe("htmlToReadableText on real-world pages", () => {
  it("keeps a news article's headline, byline, paragraphs and lists, without the site around it", () => {
    expect(htmlToReadableText(readFixture("article"), { baseUrl: "https://news.example.com/2026/10/20/bike-lanes" })).toEqual({
      title: "City council approves new bike lanes & bus routes | The Daily Example",
      description: "The council voted 7 to 2 to fund 40 km of protected bike lanes.",
      text: [
        "City council approves new bike lanes",
        "By Sam Lee · 20 October 2026",
        "The city council voted 7 to 2 on Tuesday to fund 40 km of protected bike lanes, the largest expansion since the network opened.",
        "A protected lane on Main Street.",
        "What changes",
        "- Three new east–west corridors.\n- Bus routes 12 and 14 run every 8 minutes.",
        "Read the full minutes or jump to the comments.",
      ].join("\n\n"),
      links: [
        { text: "Sam Lee", url: "https://news.example.com/authors/sam-lee" },
        { text: "12", url: "https://news.example.com/2026/10/20/routes/12" },
        { text: "14", url: "https://news.example.com/2026/10/20/routes/14" },
        { text: "full minutes", url: "https://council.example.org/minutes/2026-10-20.pdf" },
      ],
    });
  });

  it("describes a video page that is all scripts through its og: metadata", () => {
    expect(htmlToReadableText(readFixture("video"), { baseUrl: "https://video.example.com/watch?v=abc123" })).toEqual({
      title: "How a suspension bridge holds its deck",
      description: "Cables, towers and anchorages explained in 12 minutes, with a scale model.",
      text: "",
      links: [],
    });
  });

  it("takes a repository page's README, keeping code blocks line by line and links on its <base>", () => {
    expect(htmlToReadableText(readFixture("repository"), { baseUrl: "https://code.example.com/example/tiny-queue" })).toEqual({
      title: "GitHub - example/tiny-queue: A tiny job queue for Postgres",
      description: "A tiny job queue for Postgres. Contribute to example/tiny-queue development by creating an account.",
      text: [
        "tiny-queue",
        "A tiny job queue for Postgres, built on SKIP LOCKED.",
        "Install",
        "npm install tiny-queue\nnpx tiny-queue migrate",
        "Usage",
        "1. Create a queue.\n2. Add jobs with enqueue(name, payload).\n3. Run a worker.",
        "See the Postgres docs and mail the maintainer or copy.",
      ].join("\n\n"),
      links: [
        { text: "a worker", url: "https://code.example.com/docs/worker.md" },
        { text: "the Postgres docs", url: "https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE" },
      ],
    });
  });
});

describe("htmlToReadableText", () => {
  const baseUrl = "https://site.example/blog/post";

  it("returns nothing for an empty page", () => {
    expect(htmlToReadableText("", { baseUrl })).toEqual({ title: null, description: null, text: "", links: [] });
  });

  it("falls back from <title> to og:title to the first h1, and from description to og:description", () => {
    const withOg = '<meta property="og:title" content=" Og  title "><meta property="og:description" content="Og text"><h1>Heading</h1>';
    expect(htmlToReadableText(withOg, { baseUrl })).toMatchObject({ title: "Og title", description: "Og text" });
    expect(htmlToReadableText("<title>  </title><h1>The <em>heading</em></h1>", { baseUrl }).title).toBe("The heading");
  });

  it("reads the body when the page has no main and keeps main when it holds several articles", () => {
    expect(htmlToReadableText("<body><p>One</p><p>Two</p></body>", { baseUrl }).text).toBe("One\n\nTwo");
    const feed = "<header><p>Site</p></header><main><article><p>First</p></article><article><p>Second</p></article></main>";
    expect(htmlToReadableText(feed, { baseUrl }).text).toBe("First\n\nSecond");
  });

  it("drops the page's header and footer but keeps a section's own", () => {
    const html = "<body><header>Banner</header><section><header>Section title</header><p>Body</p><footer>Section note</footer></section><footer>Site</footer></body>";
    expect(htmlToReadableText(html, { baseUrl }).text).toBe("Section title\n\nBody\n\nSection note");
  });

  it("drops hidden nodes, controls and embedded media", () => {
    const html =
      '<main><p>Seen</p><p hidden>Hidden</p><div aria-hidden="true">Decor</div><iframe src="https://ads.example"></iframe><select><option>A</option></select><textarea>Draft</textarea><canvas>Chart</canvas></main>';
    expect(htmlToReadableText(html, { baseUrl }).text).toBe("Seen");
  });

  it("decodes entities and collapses whitespace", () => {
    expect(htmlToReadableText("<p>Fish &amp; chips\n\t &lt;3 &#8212; &quot;yes&quot;</p>", { baseUrl }).text).toBe('Fish & chips <3 — "yes"');
  });

  it("breaks lines at <br>, rows and list items, numbering an ordered list from its start", () => {
    const html = '<p>Line one<br>Line two</p><table><tr><th>Name</th><th>Size</th></tr><tr><td>a</td><td>1</td></tr></table><ol start="3"><li>c</li><li>d</li></ol>';
    expect(htmlToReadableText(html, { baseUrl }).text).toBe("Line one\nLine two\n\nName Size\na 1\n\n3. c\n4. d");
  });

  it("lists http(s) links once each, absolute on the page, with a label when the link has no text", () => {
    const html = [
      '<a href="/about">About</a>',
      '<a href="../archive?page=2">Older</a>',
      '<a href="/about">About again</a>',
      '<a href="https://other.example/x" aria-label="Other site"><img src="x.png"></a>',
      '<a href="#top">Top</a>',
      '<a href="post#comments">Comments</a>',
      '<a href="/other#part">Other part</a>',
      '<a href="mailto:a@site.example">Mail</a>',
      '<a href="javascript:alert(1)">Run</a>',
      '<a href="tel:+100">Call</a>',
      '<a href="http://[bad">Broken</a>',
    ].join(" ");
    expect(htmlToReadableText(`<p>${html}</p>`, { baseUrl }).links).toEqual([
      { text: "About", url: "https://site.example/about" },
      { text: "Older", url: "https://site.example/archive?page=2" },
      { text: "Other site", url: "https://other.example/x" },
      { text: "Other part", url: "https://site.example/other#part" },
    ]);
  });

  it("keeps only absolute links when the base URL does not parse", () => {
    const html = '<p><a href="/relative">Relative</a> <a href="https://site.example/abs">Absolute</a></p>';
    expect(htmlToReadableText(html, { baseUrl: "not a url" }).links).toEqual([{ text: "Absolute", url: "https://site.example/abs" }]);
  });

  it("runs no script and keeps no script text", () => {
    const html = '<p>Text</p><script>globalThis.ranFromPage = true;</script><img src="x" onerror="globalThis.ranFromPage = true">';
    expect(htmlToReadableText(html, { baseUrl }).text).toBe("Text");
    expect((globalThis as { ranFromPage?: boolean }).ranFromPage).toBeUndefined();
  });
});
