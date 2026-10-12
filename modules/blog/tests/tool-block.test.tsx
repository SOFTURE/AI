// Issue #413: a tool block turns a `::name{…}` directive into the tool's static HTML inside a mount point on the
// server, the island in the browser, the static HTML in the Markdown answer, and a gate finding for attributes the
// schema refuses.
import { readFileSync } from "node:fs";
import { blog } from "@softure-ai/blog";
import { checkArticleText, qualityOptionsSchema, renderArticle, replaceArticleBlocks, resolveQualitySettings, type BlockPlugin } from "@softure-ai/blog/server";
import { ArticleBody, defineToolBlock } from "@softure-ai/blog/ui";
import type { ReactNode } from "react";
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

const calculator = defineToolBlock({
  name: "calculator",
  schema: calculatorSchema,
  renderStatic: renderCalculatorStatic,
  Island: CalculatorIsland,
});

function renderBody(markdown: string, blocks: readonly BlockPlugin<ReactNode>[] = [calculator]): string {
  const body = renderArticle<ReactNode>(markdown, { blocks, article: { currentAsOf: "2026-10-01" } });
  return renderToStaticMarkup(<ArticleBody segments={body.segments} />);
}

describe("defineToolBlock: the page", () => {
  it("renders the static HTML in a mount point and not the island", () => {
    islandRenders.length = 0;
    const html = renderBody('Before.\n\n::calculator{rate="5"}\n\nAfter.');
    expect(html).toContain('<div class="blog-tool" data-blog-tool="calculator" data-state="static"><p class="calc">Savings: 5%</p></div>');
    expect(html.indexOf("Before.")).toBeLessThan(html.indexOf("blog-tool"));
    expect(html.indexOf("blog-tool")).toBeLessThan(html.indexOf("After."));
    expect(islandRenders).toEqual([]);
  });

  it("renders nothing for attributes the schema refuses, or the app's renderInvalid", () => {
    expect(renderBody('::calculator{rate="99"}\n\nAfter.')).not.toContain("blog-tool");
    const strict = defineToolBlock({ ...{ name: "calculator", schema: calculatorSchema, renderStatic: renderCalculatorStatic, Island: CalculatorIsland }, renderInvalid: () => '<p class="broken"></p>' });
    expect(renderBody("::calculator{rate=5}", [strict])).toContain('<p class="broken"></p>');
  });

  it("takes the app's class", () => {
    const styled = defineToolBlock({ name: "calculator", schema: calculatorSchema, renderStatic: renderCalculatorStatic, Island: CalculatorIsland, className: "tool" });
    expect(renderBody('::calculator{rate="5"}', [styled])).toContain('<div class="tool" data-blog-tool="calculator"');
  });

  it("refuses a name that is not a directive name", () => {
    expect(() => defineToolBlock({ name: "Calculator", schema: calculatorSchema, renderStatic: renderCalculatorStatic, Island: CalculatorIsland })).toThrow(
      'Tool block name "Calculator" must be lower-case kebab-case, e.g. "calculator".',
    );
  });

  it("is a block plugin the blog's options accept", () => {
    const options = blog({ blocks: [calculator] });
    expect(options).toBeDefined();
  });
});

describe("defineToolBlock: Markdown for agents", () => {
  it("replaces the directive with the static HTML, the app's markdown, or keeps an invalid line", () => {
    expect(replaceArticleBlocks('Before.\n::calculator{rate="5"}\nAfter.', [calculator])).toBe('Before.\n<p class="calc">Savings: 5%</p>\nAfter.');
    const withMarkdown = defineToolBlock({
      name: "calculator",
      schema: calculatorSchema,
      renderStatic: renderCalculatorStatic,
      Island: CalculatorIsland,
      markdown: (props) => `| Rate |\n| --- |\n| ${String(props.rate)}% |`,
    });
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

  it("passes requires and numbers through", () => {
    const tool = defineToolBlock({
      name: "calculator",
      schema: calculatorSchema,
      renderStatic: renderCalculatorStatic,
      Island: CalculatorIsland,
      requires: ["scenario"],
      numbers: (props) => [props.rate],
    });
    expect(tool.requires).toEqual(["scenario"]);
    const block = { type: "calculator", syntax: "directive" as const, info: 'rate="7"', attributes: { rate: "7" }, content: '::calculator{rate="7"}', article: {} };
    expect(tool.numbers?.(block)).toEqual([7]);
    expect(tool.numbers?.({ ...block, attributes: null })).toEqual([]);
    expect(check([tool], '::calculator{rate="5"}')).toEqual([
      { rule: "block-requires", severity: "error", message: "the calculator block needs scenario in the frontmatter", line: 20 },
    ]);
  });
});
