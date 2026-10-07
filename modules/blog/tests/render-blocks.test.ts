// Block plugins: a fenced block of a registered type is rendered by the app. The fixture plays FIRE's
// engine chart (FIRE_TRACKER `src/lib/blog-chart-html.ts`, `::wykres{}` there): it reads the article's
// `current_as_of` and its own scenario, and falls back to an error frame without the date.
import {
  findArticleBlocks,
  renderArticle,
  type BlockArticle,
  type BlockOutput,
  type BlockPlugin,
} from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderChart(info: string, content: string, article: BlockArticle): BlockOutput<never> {
  if (article.currentAsOf === undefined) {
    return { kind: "html", html: '<figure class="chart chart-error"><figcaption>The chart could not be computed.</figcaption></figure>\n' };
  }
  return {
    kind: "html",
    html: `<figure class="chart" data-chart="${escapeText(info)}"><figcaption>${escapeText(content.trim())} as of ${article.currentAsOf}</figcaption></figure>\n`,
  };
}

const chartPlugin: BlockPlugin<never> = {
  type: "chart",
  requires: ["current_as_of", "scenario"],
  render: (block) => renderChart(block.info, block.content, block.article),
};

interface FakeElement {
  readonly component: "Chart";
  readonly props: { readonly kind: string; readonly scenario: unknown };
}

const nodePlugin: BlockPlugin<FakeElement> = {
  type: "chart",
  render: (block) => ({ kind: "node", node: { component: "Chart", props: { kind: block.info, scenario: block.article.fields?.["scenario"] } } }),
};

const CHART = "```chart wealth\nwealth over 30 years\n```";

describe("renderArticle: HTML block plugins", () => {
  it("renders a chart fence between paragraphs as the plugin's figure, with the article's date", () => {
    const { html, segments } = renderArticle(`Before.\n\n${CHART}\n\nAfter.`, {
      blocks: [chartPlugin],
      article: { currentAsOf: "2026-10-01" },
    });

    expect(html).toBe(
      "<p>Before.</p>\n" +
        '<figure class="chart" data-chart="wealth"><figcaption>wealth over 30 years as of 2026-10-01</figcaption></figure>\n' +
        "<p>After.</p>\n",
    );
    expect(segments).toEqual([{ kind: "html", html }]);
  });

  it("ends a paragraph right above the fence", () => {
    const { html } = renderArticle(`Paragraph.\n${CHART}`, { blocks: [chartPlugin], article: { currentAsOf: "2026-10-01" } });
    expect(html).toMatch(/^<p>Paragraph\.<\/p>\n<figure class="chart"/);
  });

  it("lets the plugin show its own error frame without the date", () => {
    expect(renderArticle(CHART, { blocks: [chartPlugin] }).html).toContain('<figure class="chart chart-error">');
  });

  it("keeps an unregistered type, an indented block and a fence inside a list as code", () => {
    const article = { currentAsOf: "2026-10-01" };
    expect(renderArticle("```table\nx\n```", { blocks: [chartPlugin], article }).html).toBe(
      '<pre><code class="language-table">x\n</code></pre>\n',
    );
    expect(renderArticle("    ```chart\n    x\n    ```", { blocks: [chartPlugin], article }).html).toContain("<pre><code>```chart");
    expect(renderArticle(`- item\n\n  ${CHART.replaceAll("\n", "\n  ")}`, { blocks: [chartPlugin], article }).html).toContain(
      '<code class="language-chart">',
    );
  });

  it("renders a chart fence as code without the plugin", () => {
    expect(renderArticle(CHART).html).toBe('<pre><code class="language-chart">wealth over 30 years\n</code></pre>\n');
  });

  it("keeps footnotes working around a block", () => {
    const { html } = renderArticle(`A[^a].\n\n${CHART}\n\nB.\n\n[^a]: Source.`, {
      blocks: [chartPlugin],
      article: { currentAsOf: "2026-10-01" },
    });

    expect(html).toContain('<a href="#fn-1" id="fnref-1"');
    expect(html).toMatch(/<\/figure>\n<p>B\.<\/p>\n<section class="blog-footnotes"/);
  });
});

describe("renderArticle: node block plugins", () => {
  it("returns the plugin's node between HTML segments and no single HTML string", () => {
    const { html, segments } = renderArticle(`Before.\n\n${CHART}\n\nAfter.`, {
      blocks: [nodePlugin],
      article: { fields: { scenario: "w=35" } },
    });

    expect(html).toBeNull();
    expect(segments).toEqual([
      { kind: "html", html: "<p>Before.</p>\n" },
      { kind: "node", type: "chart", node: { component: "Chart", props: { kind: "wealth", scenario: "w=35" } } },
      { kind: "html", html: "<p>After.</p>\n" },
    ]);
  });

  it("returns two adjacent nodes as two segments", () => {
    const { segments } = renderArticle(`${CHART}\n${CHART}`, { blocks: [nodePlugin] });
    expect(segments.map((segment) => segment.kind)).toEqual(["node", "node"]);
  });
});

describe("renderArticle: plugin errors", () => {
  it("refuses a type that is not kebab-case and a type registered twice", () => {
    const render = (): BlockOutput => ({ kind: "html", html: "" });
    expect(() => renderArticle("x", { blocks: [{ type: "Chart", render }] })).toThrow('Block plugin type "Chart" must be lower-case kebab-case');
    expect(() => renderArticle("x", { blocks: [{ type: "chart", render }, { type: "chart", render }] })).toThrow(
      'Block plugin type "chart" is registered twice.',
    );
  });

  it("lets a throwing plugin fail the render: it is a bug in the app", () => {
    const broken: BlockPlugin = {
      type: "chart",
      render: () => {
        throw new Error("engine failed");
      },
    };
    expect(() => renderArticle(CHART, { blocks: [broken] })).toThrow("engine failed");
  });
});

describe("findArticleBlocks", () => {
  it("lists the plugin blocks of a text with their line and needs, without rendering", () => {
    const text = `# Title\n\n${CHART}\n\n\`\`\`js\nx\n\`\`\`\n\n\`\`\`chart\n\`\`\``;

    expect(findArticleBlocks(text, [chartPlugin])).toEqual([
      { type: "chart", syntax: "fence", attributes: {}, info: "wealth", line: 3, requires: ["current_as_of", "scenario"] },
      { type: "chart", syntax: "fence", attributes: {}, info: "", line: 11, requires: ["current_as_of", "scenario"] },
    ]);
  });

  it("reports no needs for a plugin that declares none", () => {
    expect(findArticleBlocks(CHART, [nodePlugin])).toEqual([{ type: "chart", syntax: "fence", attributes: {}, info: "wealth", line: 1, requires: [] }]);
  });
});
