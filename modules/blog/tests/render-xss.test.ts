// Stored XSS fixtures: whatever an author writes, the rendered body holds no script, no event handler
// and no link with an unsafe scheme.
import { renderArticle } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

function renderHtml(markdown: string): string {
  return renderArticle(markdown, { siteHosts: ["example.com"], glossary: [{ slug: "isa", forms: ["ISA"] }], toc: true }).html ?? "";
}

/** No element of the output may carry an event handler, a style or a script. */
function expectNoActiveContent(html: string): void {
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/<(?:img|iframe|object|embed|svg|math|style|form|input|button|base|meta|link)\b/i);
  expect(html).not.toMatch(/<[^>]*\son[a-z]+\s*=/i);
  expect(html).not.toMatch(/<[^>]*\sstyle\s*=/i);
}

describe("renderArticle: raw HTML", () => {
  it("escapes raw HTML in the text instead of running it", () => {
    expect(renderHtml('Text <script>alert(1)</script> and <img src=x onerror="alert(1)">')).toBe(
      "<p>Text &lt;script&gt;alert(1)&lt;/script&gt; and &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>\n",
    );
  });

  it.each([
    "<div onclick=alert(1)>block</div>",
    "<iframe src=//evil.example></iframe>",
    "<svg><script>alert(1)</script></svg>",
    "<!-- comment --><style>body{}</style>",
    "<a href=\"javascript:alert(1)\">x</a>",
    "<details open ontoggle=alert(1)>",
  ])("escapes the raw HTML block %s", (markdown) => {
    expectNoActiveContent(renderHtml(markdown));
  });
});

describe("renderArticle: link schemes", () => {
  it.each([
    "[click](javascript:alert(1))",
    "[upper](JAVASCRIPT:alert(1))",
    "[vb](vbscript:msgbox(1))",
    "[data](data:text/html,<script>alert(1)</script>)",
    "[file](file:///etc/passwd)",
    "[entity](javascript&#58;alert(1))",
    "[hex entity](&#x6A;avascript:alert(1))",
    "[tab](<java\tscript:alert(1)>)",
    "[newline](<java\nscript:alert(1)>)",
    "[spaces](<  javascript:alert(1)>)",
    "<javascript:alert(1)>",
    "[ref][r]\n\n[r]: javascript:alert(1)",
  ])("leaves %s as text", (markdown) => {
    const html = renderHtml(markdown);
    expect(html).not.toMatch(/href="[^"]*script:/i);
    expect(html).not.toMatch(/href="\s*(?:data|vbscript|file):/i);
    expectNoActiveContent(html);
  });

  it("marks a protocol-relative link as external", () => {
    expect(renderHtml("[away](//evil.example/x)")).toContain(
      '<a href="//evil.example/x" rel="noopener noreferrer" target="_blank" class="blog-external">',
    );
  });

  it("keeps a protocol-relative link to the site plain", () => {
    expect(renderHtml("[home](//example.com/)")).toBe('<p><a href="//example.com/">home</a></p>\n');
  });

  it("does not let a title break out of its attribute", () => {
    const html = renderHtml('[x](/a "\\" onmouseover=\\"alert(1)")');
    expect(html).toBe('<p><a href="/a" title="&quot; onmouseover=&quot;alert(1)">x</a></p>\n');
  });

  it("does not let a URL break out of its attribute", () => {
    const html = renderHtml('[x](/a"onmouseover="alert(1))');
    expectNoActiveContent(html);
  });
});

describe("renderArticle: generated attributes", () => {
  it("builds heading ids and the table of contents from escaped text", () => {
    const { html, toc } = renderArticle('## <img src=x onerror=alert(1)> "quoted"', { toc: true });

    expectNoActiveContent(html ?? "");
    expectNoActiveContent(toc ?? "");
    expect(toc).toContain("&lt;img src=x onerror=alert(1)&gt; &quot;quoted&quot;");
  });

  it("escapes the info string of an unregistered fence", () => {
    const html = renderHtml('```js"><script>alert(1)</script>\ncode\n```');
    expectNoActiveContent(html);
  });

  it("escapes code", () => {
    expect(renderHtml("`<script>`")).toBe("<p><code>&lt;script&gt;</code></p>\n");
  });
});
