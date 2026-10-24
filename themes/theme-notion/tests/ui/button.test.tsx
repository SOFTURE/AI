import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "../../src/ui/button.js";

function classesOf(html: string): string[] {
  return (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(" ");
}

describe("Button", () => {
  it("is the design system's 28 px primary action by default", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);

    expect(html).toContain('data-slot="button" data-variant="default" data-size="default"');
    expect(classesOf(html)).toEqual(expect.arrayContaining(["h-7", "bg-primary", "hover:bg-primary-hover", "rounded-md"]));
  });

  it("draws the Notion ghost: muted text, the grey accent on hover, no shadow", () => {
    const classes = classesOf(renderToStaticMarkup(<Button variant="ghost" size="sm">Cancel</Button>));

    expect(classes).toEqual(expect.arrayContaining(["text-muted-foreground", "hover:bg-accent", "h-6"]));
    expect(classes.some((name) => name.startsWith("shadow"))).toBe(false);
  });

  it("lets a later class win over the variant's (cn merges, the caller's class last)", () => {
    const classes = classesOf(renderToStaticMarkup(<Button className="h-8">Show</Button>));

    expect(classes).toContain("h-8");
    expect(classes).not.toContain("h-7");
  });
});
