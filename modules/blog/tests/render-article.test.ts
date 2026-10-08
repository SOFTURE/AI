// The article renderer (FIRE_TRACKER `src/lib/blog-markdown.test.ts`, in English, with the site's
// host and the glossary path as options). The oracle is HTML written by hand, not a second render.
import { blogMessages } from "@softure-ai/blog";
import { renderArticle, slugifyHeading } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const EXTERNAL_MARKER =
  '<span class="blog-external-marker" aria-hidden="true">↗</span><span class="blog-visually-hidden"> (opens in a new tab)</span>';

describe("renderArticle: links", () => {
  it("marks an external link and opens it in a new tab; own hosts, subdomains and relative links stay plain", () => {
    const { html } = renderArticle(
      "[ONS](https://www.ons.gov.uk/) [calculator](https://example.com/calculator) [app](https://app.example.com/) [here](/blog/isa)",
      { siteHosts: ["example.com"] },
    );

    expect(html).toBe(
      `<p><a href="https://www.ons.gov.uk/" rel="noopener noreferrer" target="_blank" class="blog-external">ONS${EXTERNAL_MARKER}</a> ` +
        '<a href="https://example.com/calculator">calculator</a> ' +
        '<a href="https://app.example.com/">app</a> ' +
        '<a href="/blog/isa">here</a></p>\n',
    );
  });

  it("drops the visible arrow but keeps the hidden words with externalMarker: \"text\"", () => {
    expect(renderArticle("[ONS](https://www.ons.gov.uk/)", { externalMarker: "text" }).html).toBe(
      '<p><a href="https://www.ons.gov.uk/" rel="noopener noreferrer" target="_blank" class="blog-external">ONS' +
        '<span class="blog-visually-hidden"> (opens in a new tab)</span></a></p>\n',
    );
  });

  it("adds no marker with externalMarker: \"none\" and still opens the link safely in a new tab", () => {
    expect(renderArticle("[ONS](https://www.ons.gov.uk/)", { externalMarker: "none" }).html).toBe(
      '<p><a href="https://www.ons.gov.uk/" rel="noopener noreferrer" target="_blank" class="blog-external">ONS</a></p>\n',
    );
  });

  it("keeps the arrow and the hidden words by default and with externalMarker: \"icon-and-text\"", () => {
    const expected = `<p><a href="https://www.ons.gov.uk/" rel="noopener noreferrer" target="_blank" class="blog-external">ONS${EXTERNAL_MARKER}</a></p>\n`;
    expect(renderArticle("[ONS](https://www.ons.gov.uk/)").html).toBe(expected);
    expect(renderArticle("[ONS](https://www.ons.gov.uk/)", { externalMarker: "icon-and-text" }).html).toBe(expected);
  });

  it("treats every http(s) link as external when no site host is given", () => {
    expect(renderArticle("[a](https://example.com/)").html).toContain('class="blog-external"');
  });

  it("lets mailto through as a plain link", () => {
    expect(renderArticle("[write to us](mailto:hello@example.com)").html).toBe(
      '<p><a href="mailto:hello@example.com">write to us</a></p>\n',
    );
  });

  it("turns a bare URL into a marked external link", () => {
    expect(renderArticle("See https://www.ons.gov.uk/ for data.").html).toBe(
      `<p>See <a href="https://www.ons.gov.uk/" rel="noopener noreferrer" target="_blank" class="blog-external">https://www.ons.gov.uk/${EXTERNAL_MARKER}</a> for data.</p>\n`,
    );
  });

  it("uses the copy of the given locale for the hidden text", () => {
    const { html } = renderArticle("[a](https://ons.gov.uk/)", { messages: blogMessages.pl.render });
    expect(html).toContain(`<span class="blog-visually-hidden"> ${blogMessages.pl.render.opensInNewTab}</span>`);
  });
});

describe("renderArticle: elements", () => {
  it("renders an image as its alt text without an image policy", () => {
    expect(renderArticle("![chart](https://example.com/a.png)").html).toBe("<p>chart</p>\n");
  });

  it("lets a table with numbers through", () => {
    const { html } = renderArticle("| year | amount |\n| --- | --- |\n| 2026 | 1,000 |\n");

    expect(html).toContain("<table>");
    expect(html).toContain("<td>1,000</td>");
  });

  it("renders an empty text as an empty result", () => {
    expect(renderArticle("")).toEqual({
      html: "",
      segments: [],
      headings: [],
      toc: null,
      linkedTerms: [],
      readingMinutes: 1,
    });
  });
});

describe("renderArticle: headings and the table of contents", () => {
  it("gives headings unique ids and lists them", () => {
    const { html, headings } = renderArticle(
      "## How much to pay into an ISA?\n\ntext\n\n### \u0141\u00f3d\u017a, sources\n\n## How much to pay into an ISA?\n",
    );

    expect(html).toContain('<h2 id="how-much-to-pay-into-an-isa">How much to pay into an ISA?</h2>');
    expect(html).toContain('<h3 id="lodz-sources">\u0141\u00f3d\u017a, sources</h3>');
    expect(html).toContain('<h2 id="how-much-to-pay-into-an-isa-2">How much to pay into an ISA?</h2>');
    expect(headings).toEqual([
      { level: 2, id: "how-much-to-pay-into-an-isa", text: "How much to pay into an ISA?" },
      { level: 3, id: "lodz-sources", text: "\u0141\u00f3d\u017a, sources" },
      { level: 2, id: "how-much-to-pay-into-an-isa-2", text: "How much to pay into an ISA?" },
    ]);
  });

  it("falls back to `section` for a heading without letters or digits", () => {
    expect(renderArticle("## ???\n\n## !!!").headings.map((heading) => heading.id)).toEqual(["section", "section-2"]);
  });

  it("keeps heading ids clear of the footnote ids", () => {
    expect(renderArticle("## Footnotes\n\n## Fn 1").headings.map((heading) => heading.id)).toEqual(["footnotes-2", "fn-1-2"]);
  });

  it("renders no table of contents unless asked", () => {
    expect(renderArticle("## A").toc).toBeNull();
  });

  it("renders the table of contents of h2 and h3 as nested lists", () => {
    const { toc } = renderArticle("# Title\n\n## One\n\n### One a\n\n### One b\n\n#### Deep\n\n## Two & more", { toc: true });

    expect(toc).toBe(
      '<nav class="blog-toc" aria-label="Contents"><ol>' +
        '<li><a href="#one">One</a><ol><li><a href="#one-a">One a</a></li><li><a href="#one-b">One b</a></li></ol></li>' +
        '<li><a href="#two-more">Two &amp; more</a></li>' +
        "</ol></nav>\n",
    );
  });

  it("goes deeper with maxLevel and stays null without headings", () => {
    expect(renderArticle("## A\n\n### B\n\n#### C", { toc: { maxLevel: 4 } }).toc).toBe(
      '<nav class="blog-toc" aria-label="Contents"><ol><li><a href="#a">A</a><ol><li><a href="#b">B</a><ol><li><a href="#c">C</a></li></ol></li></ol></li></ol></nav>\n',
    );
    expect(renderArticle("Just text.", { toc: true }).toc).toBeNull();
  });

  it("closes nested lists when a heading climbs back more than one level", () => {
    expect(renderArticle("## A\n\n### B\n\n#### C\n\n## D", { toc: { maxLevel: 4 } }).toc).toBe(
      '<nav class="blog-toc" aria-label="Contents"><ol><li><a href="#a">A</a><ol><li><a href="#b">B</a><ol><li><a href="#c">C</a></li></ol></li></ol></li><li><a href="#d">D</a></li></ol></nav>\n',
    );
  });
});

describe("slugifyHeading", () => {
  it.each([
    ["\u017b\u00f3\u0142\u0107 g\u0119\u015bl\u0105 ja\u017a\u0144", "zolc-gesla-jazn"],
    ["  PIT-37 and NI: what now?  ", "pit-37-and-ni-what-now"],
    ["Stra\u00dfe \u00e6 \u00f8", "strasse-ae-o"],
    ["???", ""],
  ])("%s becomes %s", (text, id) => {
    expect(slugifyHeading(text)).toBe(id);
  });
});

describe("renderArticle: footnotes", () => {
  const TEXT = ["The allowance is 20,000[^limit].", "", "[^limit]: HMRC: https://www.gov.uk/individual-savings-accounts"].join("\n");

  it("renders a reference as a numbered link, not as raw [^id]", () => {
    const { html } = renderArticle(TEXT);

    expect(html).not.toContain("[^limit]");
    expect(html).toContain('<sup class="blog-footnote-ref"><a href="#fn-1" id="fnref-1" aria-label="Footnote 1">1</a></sup>');
  });

  it("puts the notes in a section with a heading, the address as a link and a way back", () => {
    const { html } = renderArticle(TEXT, { siteHosts: ["example.com"] });

    expect(html).toContain('<section class="blog-footnotes" aria-labelledby="footnotes">');
    expect(html).toContain('<h2 id="footnotes">Notes</h2>');
    expect(html).toContain('<li id="fn-1">');
    expect(html).toContain(
      '<a href="https://www.gov.uk/individual-savings-accounts" rel="noopener noreferrer" target="_blank" class="blog-external">',
    );
    expect(html).toContain('<a href="#fnref-1" class="blog-footnote-back" aria-label="Back to text">↩</a>');
  });

  it("gives a second reference to the same note its own anchor", () => {
    const { html } = renderArticle("A[^x] and B[^x].\n\n[^x]: Source.");

    expect(html).toContain('id="fnref-1"');
    expect(html).toContain('id="fnref-1-2"');
  });

  it("keeps the notes heading out of the headings: the contents lead through the text", () => {
    expect(renderArticle(`## Question\n\n${TEXT}`).headings.map((heading) => heading.text)).toEqual(["Question"]);
  });

  it("uses the copy of the given locale", () => {
    const pl = blogMessages.pl.render;
    const { html } = renderArticle(TEXT, { messages: pl });

    expect(html).toContain(`<h2 id="footnotes">${pl.footnotesHeading}</h2>`);
    expect(html).toContain(`aria-label="${pl.footnoteLabel.replace("{number}", "1")}"`);
  });
});

describe("renderArticle: reading time", () => {
  it("counts the words of the body", () => {
    const words = Array.from({ length: 401 }, () => "word").join(" ");
    expect(renderArticle(words).readingMinutes).toBe(3);
    expect(renderArticle(words, { wordsPerMinute: 401 }).readingMinutes).toBe(1);
  });
});
