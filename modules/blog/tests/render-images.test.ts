// Images in article bodies (BF-3): emitted only under the app's image policy, with their size and lazy
// loading; any other image renders as its alt text.
import { checkArticleImage, findArticleImages, renderArticle, type ArticleImagePolicy } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const SIZES = new Map([
  ["/images/costs.png", { width: 800, height: 450 }],
  ["/images/two%20words.png", { width: 400, height: 300 }],
  ["https://cdn.example.com/a.png", { width: 1200, height: 630 }],
  ["https://img.cdn.example.com/b.png", { width: 640, height: 480 }],
  ["https://evil.test/c.png", { width: 10, height: 10 }],
]);

const POLICY: ArticleImagePolicy = { hosts: ["cdn.example.com"], dimensions: (src) => SIZES.get(src) ?? null };

function renderHtml(markdown: string, policy: ArticleImagePolicy | null = POLICY): string {
  return renderArticle(markdown, policy === null ? {} : { images: policy }).html ?? "";
}

describe("renderArticle: images under the policy", () => {
  it("emits a site image with its size, lazy loading and the alt text", () => {
    expect(renderHtml("See ![Monthly costs](/images/costs.png).")).toBe(
      '<p>See <img src="/images/costs.png" alt="Monthly costs" width="800" height="450" loading="lazy" decoding="async" class="blog-image">.</p>\n',
    );
  });

  it("emits an https image from an allowed host or its subdomain", () => {
    expect(renderHtml("![a](https://cdn.example.com/a.png)")).toContain('<img src="https://cdn.example.com/a.png" alt="a" width="1200" height="630"');
    expect(renderHtml("![b](https://img.cdn.example.com/b.png)")).toContain('<img src="https://img.cdn.example.com/b.png" alt="b" width="640" height="480"');
  });

  it("keeps the title and escapes the alt text and the title", () => {
    expect(renderHtml('![Costs *by* "type" <x>](/images/costs.png "Costs & <more>")')).toBe(
      '<p><img src="/images/costs.png" alt="Costs by &quot;type&quot; &lt;x&gt;" title="Costs &amp; &lt;more&gt;" width="800" height="450" loading="lazy" decoding="async" class="blog-image"></p>\n',
    );
  });

  it("asks for the size with the normalised source the page requests", () => {
    expect(renderHtml("![two](</images/two words.png>)")).toContain('<img src="/images/two%20words.png" alt="two" width="400" height="300"');
  });

  it("emits an image inside a link", () => {
    expect(renderHtml("[![Costs](/images/costs.png)](/blog/costs)")).toBe(
      '<p><a href="/blog/costs"><img src="/images/costs.png" alt="Costs" width="800" height="450" loading="lazy" decoding="async" class="blog-image"></a></p>\n',
    );
  });
});

describe("renderArticle: images outside the policy", () => {
  it("renders every image as its alt text without a policy", () => {
    expect(renderHtml("See ![Monthly costs](/images/costs.png).", null)).toBe("<p>See Monthly costs.</p>\n");
  });

  it.each([
    ["a host the app does not allow", "https://evil.test/c.png"],
    ["a host that only ends like an allowed one", "https://cdn.example.com.evil.test/a.png"],
    ["plain http", "http://cdn.example.com/a.png"],
    ["a protocol-relative source", "//evil.test/c.png"],
    ["a backslash read as a protocol-relative source", "/\\evil.test/c.png"],
    ["a path relative to the page", "images/costs.png"],
    ["user info before an allowed host", "https://user@cdn.example.com/a.png"],
    ["a data URL", "data:image/png;base64,iVBORw0KGgo="],
  ])("refuses %s", (_case, src) => {
    const html = renderHtml(`![Costs](${src})`);
    expect(html).not.toContain("<img");
  });

  it("drops an image without alt text, leaving no element", () => {
    expect(renderHtml("Before ![](/images/costs.png) after")).toBe("<p>Before  after</p>\n");
  });

  it("drops an image whose size the app does not know", () => {
    expect(renderHtml("![Unknown](/images/unknown.png)")).toBe("<p>Unknown</p>\n");
  });

  it.each([
    ["zero", { width: 0, height: 450 }],
    ["a fraction", { width: 800.5, height: 450 }],
    ["a negative height", { width: 800, height: -1 }],
  ])("treats %s as an unknown size", (_case, size) => {
    expect(renderHtml("![Costs](/images/costs.png)", { dimensions: () => size })).toBe("<p>Costs</p>\n");
  });

  it("escapes the alt text of a refused image", () => {
    expect(renderHtml('![<script>alert(1)</script>](https://evil.test/c.png)')).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n");
  });

  it("keeps a refused scheme as literal text, as for links", () => {
    expect(renderHtml("![x](javascript:alert(1))")).toBe("<p>![x](javascript:alert(1))</p>\n");
  });

  it("lets a throwing size resolver propagate: it is the app's bug", () => {
    const policy: ArticleImagePolicy = {
      dimensions: () => {
        throw new Error("manifest missing");
      },
    };
    expect(() => renderHtml("![Costs](/images/costs.png)", policy)).toThrow("manifest missing");
  });
});

describe("checkArticleImage", () => {
  it("lists every problem of an image, and asks for the size only of an allowed source", () => {
    const asked: string[] = [];
    const policy: ArticleImagePolicy = {
      dimensions: (src) => {
        asked.push(src);
        return null;
      },
    };
    expect(checkArticleImage({ src: "https://evil.test/c.png", alt: " " }, policy)).toEqual({ ok: false, problems: ["source", "alt"] });
    expect(checkArticleImage({ src: "/images/costs.png", alt: "" }, policy)).toEqual({ ok: false, problems: ["alt", "dimensions"] });
    expect(asked).toEqual(["/images/costs.png"]);
  });

  it("refuses every source without a policy", () => {
    expect(checkArticleImage({ src: "/images/costs.png", alt: "Costs" }, undefined)).toEqual({ ok: false, problems: ["source"] });
  });
});

describe("findArticleImages", () => {
  it("lists images with their block's line, alt text as the page shows it, including refused schemes", () => {
    const markdown = ["# Title", "", "Text ![Costs *by* type](/images/costs.png) here.", "", "- ![x](javascript:alert(1)) [^1]", "", "[^1]: ![Note](/n.png)"].join("\n");
    expect(findArticleImages(markdown)).toEqual([
      { src: "/images/costs.png", alt: "Costs by type", line: 3 },
      { src: "javascript:alert(1)", alt: "x", line: 5 },
      { src: "/n.png", alt: "Note", line: 7 },
    ]);
  });

  it("ignores images in code", () => {
    expect(findArticleImages("`![a](/a.png)`\n\n```\n![b](/b.png)\n```\n")).toEqual([]);
  });
});
