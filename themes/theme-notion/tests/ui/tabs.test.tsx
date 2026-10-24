import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "../../src/ui/tabs.js";

describe("Tabs", () => {
  it("uses the line variant by default, as the design system's view tabs", () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(html).toContain('data-slot="tabs-list" data-variant="line"');
    expect(html).toContain("bg-transparent");
  });
});
