import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { tabsListVariants as rootTabsListVariants } from "../../src/index.js";
import { tabsListVariants } from "../../src/ui/tabs-variants.js";
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

  it("keeps the 36 px list and its triggers without a touch height by default", () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(html).toContain("group-data-[orientation=horizontal]/tabs:h-9");
    expect(html).not.toContain("touch-target");
  });

  it("raises every trigger of a touch list to 44 x 44 and lets the list grow to them", () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="all">
        <TabsList size="touch">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mine" size="default">Mine</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = /data-slot="tabs-list"[^>]*class="([^"]*)"/.exec(html)?.[1]?.split(" ") ?? [];
    const all = /class="([^"]*)"[^>]*>All</.exec(html)?.[1]?.split(" ") ?? [];
    const mine = /class="([^"]*)"[^>]*>Mine</.exec(html)?.[1]?.split(" ") ?? [];

    expect(list).toContain("group-data-[orientation=horizontal]/tabs:h-auto");
    expect(list).not.toContain("group-data-[orientation=horizontal]/tabs:h-9");
    expect(all).toEqual(expect.arrayContaining(["min-h-touch-target", "min-w-touch-target"]));
    expect(mine).not.toContain("min-h-touch-target");
  });

  it("raises a single trigger with its own touch size and keeps a caller's breakpoint class", () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" size="touch" className="md:min-h-0">All</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const all = /class="([^"]*)"[^>]*>All</.exec(html)?.[1]?.split(" ") ?? [];

    expect(all).toEqual(expect.arrayContaining(["min-h-touch-target", "min-w-touch-target", "md:min-h-0"]));
  });

  it("exports the list's class builder from a plain module, the one the root re-exports (#1008)", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("../../src/ui/tabs-variants.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/^["']use client["']/m);
    expect(rootTabsListVariants).toBe(tabsListVariants);
    expect(tabsListVariants()).toContain("gap-1 bg-transparent");
    expect(tabsListVariants({ variant: "default" })).toContain("bg-muted");
  });
});
