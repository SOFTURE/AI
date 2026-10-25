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
