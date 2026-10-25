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

  it("draws a field-weight boundary around the selected pill of the default variant, outside its fill", () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="all">
        <TabsList variant="default">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mine">Mine</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const classes = /class="([^"]*)"[^>]*>All</.exec(html)?.[1]?.split(" ") ?? [];

    expect(html).toMatch(/data-state="active"[^>]*>All</);
    expect(classes).toEqual(expect.arrayContaining(["bg-clip-padding", "data-[state=active]:border-input", "focus-visible:data-[state=active]:border-ring"]));
    expect(classes).not.toContain("dark:data-[state=active]:border-border");
  });

  it("keeps the line variant's selected tab without a boundary in both schemes", () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(html).toContain(" group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent");
  });
});
