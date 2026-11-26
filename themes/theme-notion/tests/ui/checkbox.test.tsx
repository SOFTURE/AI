import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "../../src/ui/checkbox.js";

function classesOf(html: string, pattern: RegExp): string[] {
  return (pattern.exec(html)?.[1] ?? "").split(" ");
}

function iconClasses(html: string, icon: string): string[] {
  return classesOf(html, new RegExp(`<svg[^>]*class="([^"]*lucide-${icon}[^"]*)"`));
}

describe("Checkbox", () => {
  it("draws the tick at 14 px inside the 16 px box", () => {
    const html = renderToStaticMarkup(<Checkbox checked aria-label="Done" />);
    const icon = /<svg[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";

    expect(icon.split(" ")).toContain("size-3.5");
    expect(icon).not.toContain("place-content-center");
  });

  it("fills the box for the indeterminate state like the checked one", () => {
    const html = renderToStaticMarkup(<Checkbox checked="indeterminate" aria-label="Some" />);
    const root = classesOf(html, /<button[^>]*class="([^"]*)"/);

    expect(html).toContain('data-state="indeterminate"');
    expect(html).toContain('aria-checked="mixed"');
    expect(root).toEqual(
      expect.arrayContaining([
        "data-[state=indeterminate]:border-primary",
        "data-[state=indeterminate]:bg-primary",
        "data-[state=indeterminate]:text-primary-foreground",
        "dark:data-[state=indeterminate]:bg-primary",
      ]),
    );
  });

  it("shows a minus sign for the indeterminate state and the tick otherwise", () => {
    const html = renderToStaticMarkup(<Checkbox checked="indeterminate" aria-label="Some" />);
    const indicator = classesOf(html, /<span[^>]*data-slot="checkbox-indicator"[^>]*class="([^"]*)"/);
    const minus = iconClasses(html, "minus");
    const check = iconClasses(html, "check");

    expect(indicator).toContain("group/checkbox-indicator");
    expect(minus).toEqual(expect.arrayContaining(["size-3.5", "hidden", "group-data-[state=indeterminate]/checkbox-indicator:block"]));
    expect(check).toEqual(expect.arrayContaining(["size-3.5", "group-data-[state=indeterminate]/checkbox-indicator:hidden"]));
    expect(check).not.toContain("hidden");
  });
});
