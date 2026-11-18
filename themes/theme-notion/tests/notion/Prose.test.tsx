import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PROSE_CLASSES, Prose } from "../../src/notion/Prose.js";

/** The markup with the class attribute's escapes undone, so a class reads as written. */
function renderMarkup(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element).replaceAll("&amp;", "&").replaceAll("&gt;", ">");
}

describe("Prose", () => {
  it("renders a div with the prose slot and every element style on the theme's tokens", () => {
    const html = renderMarkup(<Prose>text</Prose>);

    expect(html.startsWith('<div data-slot="prose"')).toBe(true);
    for (const style of ["[&_h2]:text-heading-2", "[&_a]:text-link", "[&_code]:text-code-foreground", "[&_pre]:bg-muted", "[&_th]:text-muted-foreground"]) {
      expect(PROSE_CLASSES).toContain(style);
      expect(html).toContain(style);
    }
  });

  it("keeps the app's element with asChild and adds its classes", () => {
    const html = renderMarkup(
      <Prose asChild className="py-4">
        <article id="doc">body</article>
      </Prose>,
    );

    expect(html.startsWith("<article ")).toBe(true);
    expect(html.endsWith(">body</article>")).toBe(true);
    expect(html).toContain('id="doc"');
    expect(html).toContain('data-slot="prose"');
    expect(html).toMatch(/class="min-w-0 [^"]* py-4"/);
  });

  it("renders HTML the app passes, inside the slot", () => {
    const html = renderToStaticMarkup(<Prose dangerouslySetInnerHTML={{ __html: "<h2>Tools</h2><p>Read-only.</p>" }} />);

    expect(html).toContain("><h2>Tools</h2><p>Read-only.</p></div>");
  });
});
