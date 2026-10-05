// Glossary links in the renderer and the term matcher (FIRE_TRACKER `src/lib/blog-markdown.test.ts`,
// glossary part, and `src/lib/blog-glossary.test.ts`, in English).
import type { BlogArticle } from "@softure-ai/blog";
import { createTermMatcher, findTermFormConflicts, renderArticle, toGlossary } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const glossary = [
  { slug: "isa", forms: ["ISA"] },
  { slug: "sipp", forms: ["SIPP"] },
  { slug: "lifetime-isa", forms: ["Lifetime ISA", "Lifetime ISAs"] },
  { slug: "capital-gains-tax", forms: ["capital gains tax", "Capital Gains Tax"] },
];

const term = (slug: string, text: string): string => `<a href="/blog/glossary/${slug}" class="blog-term">${text}</a>`;

describe("renderArticle: glossary links", () => {
  it("links only the first mention of a term", () => {
    const { html, linkedTerms } = renderArticle("Pay into an ISA. Then the ISA again.", { glossary });

    expect(html).toBe(`<p>Pay into an ${term("isa", "ISA")}. Then the ISA again.</p>\n`);
    expect(linkedTerms).toEqual(["isa"]);
  });

  it("skips a heading and links the first mention in the prose below it", () => {
    const { html } = renderArticle("## What is an ISA?\n\nAn ISA is an account.", { glossary });

    expect(html).toBe(`<h2 id="what-is-an-isa">What is an ISA?</h2>\n<p>An ${term("isa", "ISA")} is an account.</p>\n`);
  });

  it("stays out of existing links and code; a manual link to a term counts", () => {
    const { html, linkedTerms } = renderArticle(
      "[ISA limit](/calculator) and `ISA` and [SIPP](/blog/glossary/sipp). Then SIPP and ISA.",
      { glossary },
    );

    expect(html).toBe(
      '<p><a href="/calculator">ISA limit</a> and <code>ISA</code> and <a href="/blog/glossary/sipp">SIPP</a>. ' +
        `Then SIPP and ${term("isa", "ISA")}.</p>\n`,
    );
    expect(linkedTerms).toEqual(["sipp", "isa"]);
  });

  it("skips footnotes: a link must not hide the address of a source", () => {
    const { html } = renderArticle("Text[^a].\n\n[^a]: The ISA regulations, https://www.legislation.gov.uk/", { glossary });

    expect(html).not.toContain("blog-term");
  });

  it("prefers the longest form and keeps Unicode word bounds", () => {
    const { html, linkedTerms } = renderArticle("Lifetime ISA is not ISAs nor ISA\u0142, while an ISA stands alone.", {
      glossary,
    });

    expect(html).toBe(
      `<p>${term("lifetime-isa", "Lifetime ISA")} is not ISAs nor ISA\u0142, while an ${term("isa", "ISA")} stands alone.</p>\n`,
    );
    expect(linkedTerms).toEqual(["lifetime-isa", "isa"]);
  });

  it("matches a listed inflection but not another case", () => {
    const { html } = renderArticle("No capital gains tax, though isa in lower case is not a term.", { glossary });

    expect(html).toBe(`<p>No ${term("capital-gains-tax", "capital gains tax")}, though isa in lower case is not a term.</p>\n`);
  });

  it("does not link a term page to itself", () => {
    const { html, linkedTerms } = renderArticle("ISA and SIPP.", { glossary, selfSlug: "isa" });

    expect(html).toBe(`<p>ISA and ${term("sipp", "SIPP")}.</p>\n`);
    expect(linkedTerms).toEqual(["sipp"]);
  });

  it("links in a table and in a list too", () => {
    const { html } = renderArticle("- an ISA account\n\n| a |\n| --- |\n| SIPP |", { glossary });

    expect(html).toContain(`<li>an ${term("isa", "ISA")} account</li>`);
    expect(html).toContain(`<td>${term("sipp", "SIPP")}</td>`);
  });

  it("renders the text unchanged without a glossary", () => {
    expect(renderArticle("ISA.").html).toBe("<p>ISA.</p>\n");
  });

  it("builds the term link with the app's path and counts manual links to it", () => {
    const termHref = (slug: string): string => `/en/glossary/${slug}/`;
    const { html, linkedTerms } = renderArticle("[SIPP](/en/glossary/sipp?ref=1#top) then ISA.", { glossary, termHref });

    expect(html).toBe('<p><a href="/en/glossary/sipp?ref=1#top">SIPP</a> then <a href="/en/glossary/isa/" class="blog-term">ISA</a>.</p>\n');
    expect(linkedTerms).toEqual(["sipp", "isa"]);
  });

  it("escapes a term path the app builds from an odd slug", () => {
    const { html } = renderArticle("ISA.", { glossary: [{ slug: 'x"><script>', forms: ["ISA"] }] });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"><');
  });
});

describe("createTermMatcher", () => {
  it("finds nothing with an empty glossary", () => {
    expect(createTermMatcher([])("ISA and SIPP")).toEqual([]);
  });

  it("finds every occurrence left to right, with its position and slug", () => {
    const match = createTermMatcher([
      { slug: "isa", forms: ["ISA"] },
      { slug: "bridge-to-retirement", forms: ["bridge to retirement"] },
    ]);

    expect(match("Bridge to retirement before ISA.")).toEqual([
      { index: 0, text: "Bridge to retirement", slug: "bridge-to-retirement" },
      { index: 28, text: "ISA", slug: "isa" },
    ]);
  });

  it("does not take the word bridge in a plain sentence for the term", () => {
    expect(createTermMatcher([{ slug: "bridge-to-retirement", forms: ["bridge to retirement"] }])("A bridge over the river.")).toEqual([]);
  });

  it("escapes regular expression characters in a form", () => {
    expect(createTermMatcher([{ slug: "x", forms: ["a.b (c)"] }])("a.b (c) and axb (c)")).toEqual([{ index: 0, text: "a.b (c)", slug: "x" }]);
  });

  it("gives a form claimed by two terms to the first one", () => {
    expect(createTermMatcher([{ slug: "a", forms: ["ISA"] }, { slug: "b", forms: ["ISA"] }])("ISA")).toEqual([{ index: 0, text: "ISA", slug: "a" }]);
  });

  it("ignores blank forms", () => {
    expect(createTermMatcher([{ slug: "a", forms: ["  ", ""] }])("anything")).toEqual([]);
  });
});

describe("toGlossary", () => {
  it("keeps the terms with forms from stored rows and drops articles", () => {
    const rows: Pick<BlogArticle, "kind" | "slug" | "termForms">[] = [
      { kind: "term", slug: "isa", termForms: ["ISA", "ISAs"] },
      { kind: "article", slug: "how-to-start", termForms: [] },
      { kind: "term", slug: "empty", termForms: [] },
    ];

    expect(toGlossary(rows)).toEqual([{ slug: "isa", forms: ["ISA", "ISAs"] }]);
  });
});

describe("findTermFormConflicts", () => {
  it("finds a form two terms claim, with both slugs sorted", () => {
    expect(findTermFormConflicts([{ slug: "sipp", forms: ["pension"] }, { slug: "isa", forms: ["ISA", "pension"] }])).toEqual([{ form: "pension", slugs: ["isa", "sipp"] }]);
  });

  it("treats forms that differ only in a capital first letter as one, like the matcher", () => {
    expect(findTermFormConflicts([{ slug: "a", forms: ["index fund"] }, { slug: "b", forms: [" Index fund "] }])).toEqual([{ form: "index fund", slugs: ["a", "b"] }]);
    expect(findTermFormConflicts([{ slug: "a", forms: ["IKE"] }, { slug: "b", forms: ["Ike"] }])).toEqual([]);
  });

  it("agrees with the matcher: the conflicting form links to the first term only", () => {
    const terms = [{ slug: "a", forms: ["ike"] }, { slug: "b", forms: ["Ike"] }];
    expect(findTermFormConflicts(terms)).toEqual([{ form: "ike", slugs: ["a", "b"] }]);
    expect(createTermMatcher(terms)("Ike said so.")).toEqual([{ index: 0, text: "Ike", slug: "a" }]);
  });

  it("names every term of a form, and ignores a form one term lists twice or an empty one", () => {
    expect(findTermFormConflicts([{ slug: "c", forms: ["ETF"] }, { slug: "a", forms: ["ETF"] }, { slug: "b", forms: ["ETF"] }])).toEqual([{ form: "ETF", slugs: ["a", "b", "c"] }]);
    expect(findTermFormConflicts([{ slug: "a", forms: ["ETF", "ETF", " "] }, { slug: "b", forms: [""] }])).toEqual([]);
  });

  it("returns conflicts sorted by form", () => {
    const terms = [{ slug: "a", forms: ["zeta", "alpha"] }, { slug: "b", forms: ["zeta", "alpha"] }];
    expect(findTermFormConflicts(terms).map((conflict) => conflict.form)).toEqual(["alpha", "zeta"]);
  });
});
