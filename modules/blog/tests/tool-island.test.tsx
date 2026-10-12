// @vitest-environment happy-dom
// Issue #413: the server markup of a tool block hydrates without a mismatch, then the island replaces the static
// HTML with the parsed props.
import { renderArticle } from "@softure-ai/blog/server";
import { ArticleBody, defineToolBlock } from "@softure-ai/blog/ui";
import { act, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Tells React that this test drives updates through act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const schema = z.object({ rate: z.coerce.number() });

function RateIsland({ rate }: { readonly rate: number }) {
  return <output>live {rate}</output>;
}

const rate = defineToolBlock({ name: "rate", schema, renderStatic: (props) => `<p>static ${String(props.rate)}</p>`, Island: RateIsland });

function renderPage(): ReactNode {
  const body = renderArticle<ReactNode>('Intro.\n\n::rate{rate="4"}', { blocks: [rate] });
  return <ArticleBody segments={body.segments} />;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("BlogToolIsland: hydration", () => {
  it("serves the static HTML, then mounts the island with the parsed props", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(renderPage());
    document.body.append(container);
    expect(container.querySelector("[data-blog-tool]")?.innerHTML).toBe("<p>static 4</p>");

    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, renderPage(), { onRecoverableError: (error) => recoverable.push(error) });
      await Promise.resolve();
    });

    const mount = container.querySelector("[data-blog-tool='rate']");
    expect(mount?.getAttribute("data-state")).toBe("live");
    expect(mount?.innerHTML).toBe("<output>live 4</output>");
    expect(container.textContent).toContain("Intro.");
    expect(recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });
});
