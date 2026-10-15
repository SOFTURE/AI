// @vitest-environment happy-dom
// Issues #413 and #509: the server markup of a tool block hydrates without a mismatch, then the island replaces the
// static HTML (`replace`) or mounts after it (`append`) with the parsed props. A lazy island loads only after
// hydration, and the mount point keeps the static HTML until it resolves.
import { defineToolBlock, defineToolBlocks } from "@softure-ai/blog";
import { renderArticle } from "@softure-ai/blog/server";
import { ArticleBody, lazyToolIsland, type BlogBodyNode, type BlogToolIslands } from "@softure-ai/blog/ui";
import { act, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Tells React that this test drives updates through act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const schema = z.object({ rate: z.coerce.number() });
type RateProps = z.infer<typeof schema>;

function RateIsland({ rate }: RateProps) {
  return <output>live {rate}</output>;
}

const renderStatic = (props: RateProps) => `<p>static ${String(props.rate)}</p>`;
const rate = defineToolBlock({ name: "rate", schema, renderStatic });
const tools = defineToolBlocks({ name: "tool", tools: { rate: { schema, renderStatic, mode: "append" } } });

function renderPage(markdown: string, islands: BlogToolIslands): ReactNode {
  const body = renderArticle<BlogBodyNode>(markdown, { blocks: [rate, tools] });
  return <ArticleBody segments={body.segments} context={{ tools: islands }} />;
}

/** Serves the page's server HTML, hydrates it and returns the container and the hydration problems. */
async function hydratePage(markdown: string, islands: BlogToolIslands) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(renderPage(markdown, islands));
  document.body.append(container);
  const serverHtml = container.innerHTML;
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const recoverable: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, renderPage(markdown, islands), { onRecoverableError: (error) => recoverable.push(error) });
    await Promise.resolve();
  });
  return { container, serverHtml, recoverable, errors };
}

function visibleMount(container: HTMLElement, selector: string): Element | undefined {
  // React hides suspended content with `display: none` instead of removing it.
  return [...container.querySelectorAll(selector)].find((element) => !(element as HTMLElement).style.display.includes("none"));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("BlogToolIsland: hydration", () => {
  it("serves the static HTML, then mounts the island with the parsed props", async () => {
    const { container, serverHtml, recoverable, errors } = await hydratePage('Intro.\n\n::rate{rate="4"}', { rate: RateIsland });
    expect(serverHtml).toContain("<p>static 4</p>");
    const mount = container.querySelector("[data-blog-tool='rate']");
    expect(mount?.getAttribute("data-state")).toBe("live");
    expect(mount?.innerHTML).toBe("<output>live 4</output>");
    expect(container.textContent).toContain("Intro.");
    expect(recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("keeps the static HTML and mounts the island after it in append mode", async () => {
    const { container, serverHtml, recoverable, errors } = await hydratePage('::tool{type="rate" rate="4"}', { rate: RateIsland });
    expect(serverHtml).toContain('<div data-blog-tool-part="static"><p>static 4</p></div><div data-blog-tool-part="island"></div>');
    const mount = container.querySelector("[data-blog-tool='tool']");
    expect(mount?.getAttribute("data-blog-tool-type")).toBe("rate");
    expect(mount?.getAttribute("data-state")).toBe("live");
    expect(mount?.querySelector("[data-blog-tool-part='static']")?.innerHTML).toBe("<p>static 4</p>");
    expect(mount?.querySelector("[data-blog-tool-part='island']")?.innerHTML).toBe("<output>live 4</output>");
    expect(recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("keeps a tool without an island static", async () => {
    const { container, recoverable, errors } = await hydratePage('::rate{rate="4"}', {});
    expect(container.querySelector("[data-blog-tool='rate']")?.outerHTML).toBe('<div class="blog-tool" data-blog-tool="rate" data-state="static"><p>static 4</p></div>');
    expect(recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });
});

describe("lazyToolIsland", () => {
  it("loads the island only after hydration and shows the static HTML until it resolves", async () => {
    let resolveIsland: (island: typeof RateIsland) => void = () => undefined;
    const load = vi.fn(() => new Promise<typeof RateIsland>((resolve) => (resolveIsland = resolve)));
    const LazyRate = lazyToolIsland(load);

    const container = document.createElement("div");
    container.innerHTML = renderToString(renderPage('::rate{rate="4"}', { rate: LazyRate }));
    expect(load).not.toHaveBeenCalled();
    expect(container.querySelector("[data-blog-tool='rate']")?.innerHTML).toBe("<p>static 4</p>");
    document.body.append(container);

    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, renderPage('::rate{rate="4"}', { rate: LazyRate }), { onRecoverableError: (error) => recoverable.push(error) });
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(visibleMount(container, "[data-blog-tool='rate']")?.innerHTML).toBe("<p>static 4</p>");

    await act(async () => {
      resolveIsland(RateIsland);
      await Promise.resolve();
    });
    const live = visibleMount(container, "[data-blog-tool='rate']");
    expect(live?.getAttribute("data-state")).toBe("live");
    expect(live?.innerHTML).toBe("<output>live 4</output>");
    expect(container.querySelectorAll("[data-blog-tool='rate']")).toHaveLength(1);
    expect(recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });
});
