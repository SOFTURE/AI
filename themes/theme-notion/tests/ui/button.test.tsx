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

  it("keeps the outline's opaque background on hover and lays the accent over it", () => {
    const classes = classesOf(renderToStaticMarkup(<Button variant="outline">Layers</Button>));

    expect(classes).toEqual(expect.arrayContaining(["bg-background", "hover:bg-linear-to-r", "hover:from-accent", "hover:to-accent"]));
    expect(classes.filter((name) => name.startsWith("hover:bg-accent"))).toEqual([]);
  });

  it("draws a floating button: opaque in every state, the menu shadow, no border", () => {
    const classes = classesOf(renderToStaticMarkup(<Button variant="floating" aria-expanded={true}>Layers</Button>));

    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-background",
        "text-foreground",
        "shadow-menu",
        "hover:bg-linear-to-r",
        "hover:from-accent",
        "hover:to-accent",
        "aria-expanded:bg-linear-to-r",
        "aria-expanded:from-accent-strong",
        "aria-expanded:to-accent-strong",
      ]),
    );
    expect(classes.filter((name) => /^(\S+:)?bg-accent/.test(name) || name === "border")).toEqual([]);
  });

  it("keeps a disabled floating button opaque, its label muted", () => {
    const classes = classesOf(renderToStaticMarkup(<Button variant="floating" disabled>Layers</Button>));

    expect(classes).toEqual(expect.arrayContaining(["disabled:opacity-100", "disabled:text-muted-foreground", "disabled:shadow-none"]));
    expect(classes).not.toContain("disabled:opacity-50");
  });

  it("lets a later class win over the variant's (cn merges, the caller's class last)", () => {
    const classes = classesOf(renderToStaticMarkup(<Button className="h-8">Show</Button>));

    expect(classes).toContain("h-8");
    expect(classes).not.toContain("h-7");
  });
});
