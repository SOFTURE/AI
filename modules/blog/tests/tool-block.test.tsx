// Issues #413 and #509: a tool block turns a `::name{…}` directive (or `::tool{type="name" …}` for several tools)
// into a data node on the page, which `ArticleBody` renders with the app's island; the static HTML in the Markdown
// answer; and a gate finding for attributes the schema refuses or an unknown tool type.
import { readFileSync } from "node:fs";
import { blog, defineToolBlock, defineToolBlocks, isBlogToolNode, type BlogToolNode } from "@softure-ai/blog";
import { checkArticleText, qualityOptionsSchema, renderArticle, replaceArticleBlocks, resolveQualitySettings, type BlockPlugin } from "@softure-ai/blog/server";
import { ArticleBody, type BlogBodyNode, type BlogToolIslands } from "@softure-ai/blog/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const MODEL = readFileSync(new URL("./quality/fixtures/index-funds.txt", import.meta.url), "utf8");

const calculatorSchema = z.object({ rate: z.coerce.number().min(0).max(20), title: z.string().default("Savings") });
type CalculatorProps = z.infer<typeof calculatorSchema>;

const islandRenders: CalculatorProps[] = [];

function CalculatorIsland(props: CalculatorProps) {
  islandRenders.push(props);
  return <output>live {props.rate}</output>;
}

function renderCalculatorStatic(props: CalculatorProps): string {
  return `<p class="calc">${props.title}: ${String(props.rate)}%</p>`;
}

const calculatorTool = { schema: calculatorSchema, renderStatic: renderCalculatorStatic };
const calculator = defineToolBlock({ name: "calculator", ...calculatorTool });

const chartSchema = z.object({ years: z.coerce.number().int().positive() });
const sharedTools = defineToolBlocks({
  name: "tool",
  tools: {
    calculator: calculatorTool,
    chart: {
      schema: chartSchema,
      renderStatic: (props: z.infer<typeof chartSchema>) => `<svg data-years="${String(props.years)}"></svg>`,
      mode: "append",
      markdown: (props: z.infer<typeof chartSchema>) => `Chart over ${String(props.years)} years.`,
      numbers: (props: z.infer<typeof chartSchema>) => [props.years],
    },
  },
});

const ISLANDS: BlogToolIslands = { calculator: CalculatorIsland };

function renderNodes(markdown: string, blocks: readonly BlockPlugin<BlogToolNode>[] = [calculator]) {
  return renderArticle<BlogToolNode>(markdown, { blocks, article: { currentAsOf: "2026-10-01" } }).segments.flatMap((segment) => (segment.kind === "node" ? [segment.node] : []));
}

function renderBody(markdown: string, blocks: readonly BlockPlugin<BlogToolNode>[] = [calculator]): string {
  const body = renderArticle<BlogBodyNode>(markdown, { blocks, article: { currentAsOf: "2026-10-01" } });
  return renderToStaticMarkup(<ArticleBody segments={body.segments} context={{ tools: ISLANDS }} />);
}

describe("defineToolBlock: the plugin returns data", () => {
  it("renders a serializable node with the parsed props and the static HTML", () => {
    const nodes = renderNodes('Before.\n\n::calculator{rate="5"}\n\nAfter.');
    expect(nodes).toEqual([
      { kind: "blog-tool", directive: "calculator", tool: "calculator", props: { rate: 5, title: "Savings" }, html: '<p class="calc">Savings: 5%</p>', mode: "replace", className: "blog-tool" },
    ]);
    expect(JSON.parse(JSON.stringify(nodes))).toEqual(nodes);
    expect(nodes.every(isBlogToolNode)).toBe(true);
    expect(isBlogToolNode({ kind: "chart" })).toBe(false);
    expect(isBlogToolNode(null)).toBe(false);
  });

  it("takes the mode and the app's class", () => {
    const styled = defineToolBlock({ name: "calculator", ...calculatorTool, mode: "append", className: "tool" });
    expect(renderNodes('::calculator{rate="5"}', [styled])[0]).toMatchObject({ mode: "append", className: "tool" });
  });

  it("refuses a name that is not a directive name", () => {
    expect(() => defineToolBlock({ name: "Calculator", ...calculatorTool })).toThrow('Tool block name "Calculator" must be lower-case kebab-case, e.g. "calculator".');
    expect(() => defineToolBlocks({ name: "tool", tools: {} })).toThrow('Tool block "tool" needs at least one tool.');
  });

  it("is a block plugin the blog's options accept", () => {
    expect(blog({ blocks: [calculator, sharedTools] })).toBeDefined();
  });
});

describe("defineToolBlock: the page", () => {
  it("renders the static HTML in a mount point and not the island", () => {
    islandRenders.length = 0;
    const html = renderBody('Before.\n\n::calculator{rate="5"}\n\nAfter.');
    expect(html).toContain('<div class="blog-tool" data-blog-tool="calculator" data-state="static"><p class="calc">Savings: 5%</p></div>');
    expect(html.indexOf("Before.")).toBeLessThan(html.indexOf("blog-tool"));
    expect(html.indexOf("blog-tool")).toBeLessThan(html.indexOf("After."));
    expect(islandRenders).toEqual([]);
  });

  it("keeps the static HTML of a tool the app gave no island", () => {
    const body = renderArticle<BlogBodyNode>('::calculator{rate="5"}', { blocks: [calculator] });
    expect(renderToStaticMarkup(<ArticleBody segments={body.segments} />)).toContain(
      '<div class="blog-tool" data-blog-tool="calculator" data-state="static"><p class="calc">Savings: 5%</p></div>',
    );
  });

  it("renders nothing for attributes the schema refuses, or the app's renderInvalid", () => {
    expect(renderBody('::calculator{rate="99"}\n\nAfter.')).not.toContain("blog-tool");
    const strict = defineToolBlock({ name: "calculator", ...calculatorTool, renderInvalid: () => '<p class="broken"></p>' });
    expect(renderBody("::calculator{rate=5}", [strict])).toContain('<p class="broken"></p>');
  });

  it("renders an append tool's static HTML with an empty island element after it", () => {
    expect(renderBody('::tool{type="chart" years="10"}', [sharedTools])).toContain(
      '<div class="blog-tool" data-blog-tool="tool" data-blog-tool-type="chart" data-state="static"><svg data-years="10"></svg></div>',
    );
    const withChart = renderArticle<BlogBodyNode>('::tool{type="chart" years="10"}', { blocks: [sharedTools] });
    const html = renderToStaticMarkup(<ArticleBody segments={withChart.segments} context={{ tools: { chart: CalculatorIsland } }} />);
    expect(html).toContain(
      '<div class="blog-tool" data-blog-tool="tool" data-blog-tool-type="chart" data-mode="append" data-state="static"><div data-blog-tool-part="static"><svg data-years="10"></svg></div><div data-blog-tool-part="island"></div></div>',
    );
  });
});

describe("defineToolBlocks: one directive, several tools", () => {
  it("picks the tool by type and passes it the other attributes", () => {
    expect(renderNodes('::tool{type="calculator" rate="5"}\n\n::tool{type="chart" years="10"}', [sharedTools])).toEqual([
      { kind: "blog-tool", directive: "tool", tool: "calculator", props: { rate: 5, title: "Savings" }, html: '<p class="calc">Savings: 5%</p>', mode: "replace", className: "blog-tool" },
      { kind: "blog-tool", directive: "tool", tool: "chart", props: { years: 10 }, html: '<svg data-years="10"></svg>', mode: "append", className: "blog-tool" },
    ]);
  });

  it("renders nothing for a missing or unknown type", () => {
    expect(renderNodes('::tool{rate="5"}', [sharedTools])).toEqual([]);
    expect(renderNodes('::tool{type="map"}', [sharedTools])).toEqual([]);
  });

  it("gives each tool's Markdown and keeps a refused line", () => {
    expect(replaceArticleBlocks('::tool{type="chart" years="10"}\n::tool{type="calculator" rate="5"}', [sharedTools])).toBe(
      'Chart over 10 years.\n<p class="calc">Savings: 5%</p>',
    );
    expect(replaceArticleBlocks('::tool{type="map"}', [sharedTools])).toBe('::tool{type="map"}');
  });

  it("gives each tool's numbers, and no check for a tool without them or a refused line", () => {
    const block = { type: "tool", syntax: "directive" as const, info: "", content: "::tool", article: {} };
    expect(sharedTools.numbers?.({ ...block, attributes: { type: "chart", years: "10" } })).toEqual([10]);
    expect(sharedTools.numbers?.({ ...block, attributes: { type: "calculator", rate: "5" } })).toBeNull();
    expect(sharedTools.numbers?.({ ...block, attributes: { type: "chart", years: "x" } })).toBeNull();
    expect(calculator.numbers).toBeUndefined();
  });
});

describe("defineToolBlock: Markdown for agents", () => {
  it("replaces the directive with the static HTML, the app's markdown, or keeps an invalid line", () => {
    expect(replaceArticleBlocks('Before.\n::calculator{rate="5"}\nAfter.', [calculator])).toBe('Before.\n<p class="calc">Savings: 5%</p>\nAfter.');
    const withMarkdown = defineToolBlock({ name: "calculator", ...calculatorTool, markdown: (props) => `| Rate |\n| --- |\n| ${String(props.rate)}% |` });
    expect(replaceArticleBlocks('::calculator{rate="5"}', [withMarkdown])).toBe("| Rate |\n| --- |\n| 5% |");
    expect(replaceArticleBlocks('::calculator{rate="99"}', [calculator])).toBe('::calculator{rate="99"}');
  });
});

describe("defineToolBlock: the quality gate", () => {
  function check(blocks: readonly BlockPlugin[], line: string) {
    const settings = resolveQualitySettings(qualityOptionsSchema.parse({ limits: { words: { article: { min: 150 } } }, blocks }), {
      appOrigin: "https://example.com",
      timezone: "UTC",
    });
    const text = MODEL.replace("## What does an index fund charge?", `${line}\n\n## What does an index fund charge?`);
    return checkArticleText({ text, fileName: "index-funds.md", settings, today: "2026-10-03" }).findings;
  }

  it("passes valid attributes and reports the schema's issues at the directive's line", () => {
    expect(check([calculator], '::calculator{rate="5"}')).toEqual([]);
    expect(check([calculator], '::calculator{rate="99"}')).toEqual([
      { rule: "block-directive", severity: "error", message: "the attributes of ::calculator do not fit: rate: Too big: expected number to be <=20", line: 20 },
    ]);
  });

  it("reports a missing or unknown type of a shared directive, and skips the numbers of a tool without them", () => {
    expect(check([sharedTools], '::tool{type="calculator" rate="5"}')).toEqual([]);
    expect(check([sharedTools], '::tool{type="map"}')).toEqual([
      { rule: "block-directive", severity: "error", message: "the attributes of ::tool do not fit: type must be one of: calculator, chart", line: 20 },
    ]);
  });

  it("passes requires and numbers through", () => {
    const tool = defineToolBlock({ name: "calculator", ...calculatorTool, requires: ["scenario"], numbers: (props) => [props.rate] });
    expect(tool.requires).toEqual(["scenario"]);
    const block = { type: "calculator", syntax: "directive" as const, info: 'rate="7"', attributes: { rate: "7" }, content: '::calculator{rate="7"}', article: {} };
    expect(tool.numbers?.(block)).toEqual([7]);
    expect(tool.numbers?.({ ...block, attributes: null })).toBeNull();
    expect(check([tool], '::calculator{rate="5"}')).toEqual([
      { rule: "block-requires", severity: "error", message: "the calculator block needs scenario in the frontmatter", line: 20 },
    ]);
  });
});
