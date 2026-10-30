import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScrollArea } from "../../src/ui/scroll-area.js";

describe("ScrollArea", () => {
  it("makes the viewport reachable by keyboard", () => {
    const html = renderToStaticMarkup(<ScrollArea>Text</ScrollArea>);

    expect(html).toMatch(/<div[^>]*tabindex="0"[^>]*data-slot="scroll-area-viewport"/);
  });

  it("passes viewport props through, so the tab stop can be removed", () => {
    const html = renderToStaticMarkup(
      <ScrollArea viewportProps={{ tabIndex: -1, className: "p-2" }}>Text</ScrollArea>,
    );

    expect(html).toMatch(/<div[^>]*tabindex="-1"[^>]*data-slot="scroll-area-viewport"[^>]*class="[^"]*\bp-2\b/);
    expect(html).not.toContain('tabindex="0"');
  });
});

describe("ScrollArea scrollbars", () => {
  // Radix mounts a scrollbar only once it measures an overflow; `type="always"` keeps it mounted in the test DOM.
  function readBars(scrollbars?: "vertical" | "horizontal" | "both"): string[] {
    const html = renderToStaticMarkup(
      <ScrollArea type="always" {...(scrollbars === undefined ? {} : { scrollbars })}>
        Text
      </ScrollArea>,
    );
    return [...html.matchAll(/data-orientation="(\w+)"[^>]*data-slot="scroll-area-scrollbar"|data-slot="scroll-area-scrollbar"[^>]*data-orientation="(\w+)"/g)].map((match) => match[1] ?? match[2] ?? "");
  }

  it("draws a vertical bar by default", () => {
    expect(readBars()).toEqual(["vertical"]);
  });

  it("draws a horizontal bar for a strip wider than its box", () => {
    expect(readBars("horizontal")).toEqual(["horizontal"]);
  });

  it("draws both bars for content that scrolls both ways", () => {
    expect(readBars("both")).toEqual(["vertical", "horizontal"]);
  });
});
