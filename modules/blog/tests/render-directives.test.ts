// Directive blocks: a line `::name{key="value"}` of a registered directive plugin is rendered by the app,
// the way existing articles embed engine charts and tools. The gate finds the same lines.
import { findArticleBlocks, parseDirectiveAttributes, renderArticle, type ArticleBlock, type BlockPlugin } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const seen: ArticleBlock[] = [];

const chartDirective: BlockPlugin<never> = {
  type: "chart",
  syntax: "directive",
  requires: ["current_as_of"],
  render: (block) => {
    seen.push(block);
    const kind = block.attributes?.["type"] ?? "broken";
    return { kind: "html", html: `<figure class="chart" data-chart="${kind}"></figure>\n` };
  },
};

const chartFence: BlockPlugin<never> = {
  type: "chart",
  render: () => ({ kind: "html", html: '<figure class="fence"></figure>\n' }),
};

const LINE = '::chart{type="wealth" scenario="w=35&d=300000"}';

function render(markdown: string, blocks: readonly BlockPlugin<never>[] = [chartDirective]) {
  seen.length = 0;
  return renderArticle(markdown, { blocks, article: { currentAsOf: "2026-10-01" } });
}

describe("renderArticle: directive plugins", () => {
  it("renders a directive line between paragraphs with its attributes", () => {
    expect(render(`Before.\n\n${LINE}\n\nAfter.`).html).toBe(
      '<p>Before.</p>\n<figure class="chart" data-chart="wealth"></figure>\n<p>After.</p>\n',
    );
    expect(seen).toEqual([
      {
        type: "chart",
        syntax: "directive",
        info: 'type="wealth" scenario="w=35&d=300000"',
        attributes: { type: "wealth", scenario: "w=35&d=300000" },
        content: LINE,
        article: { currentAsOf: "2026-10-01" },
      },
    ]);
  });

  it("ends a paragraph right above the directive", () => {
    expect(render(`Paragraph.\n${LINE}`).html).toBe('<p>Paragraph.</p>\n<figure class="chart" data-chart="wealth"></figure>\n');
  });

  it("takes a directive without braces and with spaces around it", () => {
    render("  ::chart  ");
    expect(seen.map((block) => [block.info, block.attributes])).toEqual([["", {}]]);
  });

  it("passes null attributes when the braces cannot be read", () => {
    expect(render('::chart{type=wealth}').html).toBe('<figure class="chart" data-chart="broken"></figure>\n');
    expect(seen[0]?.attributes).toBeNull();
    render('::chart{type="a" type="b"}');
    expect(seen[0]?.attributes).toBeNull();
    render('::chart{type="a"');
    expect(seen[0]?.attributes).toBeNull();
  });

  it("leaves a directive in a list, a quote, a fence or indented code as text", () => {
    expect(render(`- item\n\n  ${LINE}`).html).not.toContain("<figure");
    expect(render(`> ${LINE}`).html).not.toContain("<figure");
    expect(render("```\n" + LINE + "\n```").html).toContain("<pre><code>::chart{");
    expect(render(`    ${LINE}`).html).toContain("<pre><code>::chart{");
    expect(seen).toEqual([]);
  });

  it("leaves an unregistered name and an inline mention as text", () => {
    expect(render('::table{type="x"}').html).toBe('<p>::table{type=&quot;x&quot;}</p>\n');
    expect(render(`See ${LINE} here.`).html).not.toContain("<figure");
  });

  it("keeps fence and directive plugins of the same type apart", () => {
    expect(render("```chart\nx\n```", [chartDirective]).html).toContain('<code class="language-chart">');
    expect(render(LINE, [chartFence]).html).toContain("<p>::chart{");
    expect(render(`${LINE}\n\n\`\`\`chart\nx\n\`\`\``, [chartDirective, chartFence]).html).toBe(
      '<figure class="chart" data-chart="wealth"></figure>\n<figure class="fence"></figure>\n',
    );
  });

  it("refuses a type registered twice for one syntax", () => {
    expect(() => render(LINE, [chartDirective, chartDirective])).toThrow('Block plugin type "chart" (directive) is registered twice.');
  });

  it("finds directive blocks with their lines, attributes and problems", () => {
    expect(findArticleBlocks(`Intro.\n\n${LINE}\n\n::chart{bad}`, [chartDirective, chartFence])).toEqual([
      { type: "chart", syntax: "directive", info: 'type="wealth" scenario="w=35&d=300000"', attributes: { type: "wealth", scenario: "w=35&d=300000" }, line: 3, endLine: 3, content: LINE, requires: ["current_as_of"] },
      { type: "chart", syntax: "directive", info: "bad", attributes: null, line: 5, endLine: 5, content: "::chart{bad}", requires: ["current_as_of"] },
    ]);
  });
});

describe("parseDirectiveAttributes", () => {
  it("reads pairs with or without whitespace between them", () => {
    expect(parseDirectiveAttributes(' a="1"  b="x y" ')).toEqual({ a: "1", b: "x y" });
    expect(parseDirectiveAttributes('a="1"b="2"')).toEqual({ a: "1", b: "2" });
    expect(parseDirectiveAttributes("")).toEqual({});
  });

  it("refuses a repeated key, a bare word, an unclosed value and a missing quote", () => {
    expect(parseDirectiveAttributes('a="1" a="2"')).toBeNull();
    expect(parseDirectiveAttributes('a="1" junk')).toBeNull();
    expect(parseDirectiveAttributes('a="1')).toBeNull();
    expect(parseDirectiveAttributes("a=1")).toBeNull();
  });

  it("stays linear on long runs of spaces or key characters", () => {
    const started = performance.now();
    expect(parseDirectiveAttributes(" ".repeat(200_000) + "!")).toBeNull();
    expect(parseDirectiveAttributes("a".repeat(200_000))).toBeNull();
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
