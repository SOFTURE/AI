// Issue #380: the method page takes the app's own sections. Each body is a node (a list of checks, a
// link, a `mailto:` address) or a string in a paragraph; the AI disclosure and the footer note stay.
import { getPageContext } from "@softure-ai/blog/server";
import { BlogMethodView, type BlogMethodSection, type BlogPageContext } from "@softure-ai/blog/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

const DEFAULT_IDS = ["who", "facts", "sources", "checks", "corrections"];

const SECTIONS: readonly BlogMethodSection[] = [
  {
    id: "checks",
    title: "What we check",
    body: (
      <ul>
        <li>Every number against its source</li>
        <li>Every year against the calendar</li>
      </ul>
    ),
  },
  { id: "calculator", title: "Our calculator", body: <p>Run the numbers in <a href="/calculator">the calculator</a>.</p> },
  { id: "fixes", title: "Corrections", body: "Write to fixes@example.com." },
  { id: "contact", title: "Contact", body: <p><a href="mailto:fixes@example.com">fixes@example.com</a></p> },
];

function createContext(options: Parameters<typeof createConfig>[0] = {}): BlogPageContext {
  return getPageContext(createConfig({ brand: { name: "Example" }, methodPage: true, disclaimer: { en: "Not investment advice." }, ...options }));
}

function readSectionIds(html: string): string[] {
  return [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("method page sections (#380)", () => {
  it("renders the app's sections in order in place of the default ones", () => {
    const html = renderToStaticMarkup(<BlogMethodView context={createContext()} sections={SECTIONS} />);
    expect(readSectionIds(html)).toEqual(["checks", "calculator", "fixes", "contact"]);
    expect(html).toContain(
      '<section id="checks" aria-labelledby="checks-heading" class="blog-section"><h2 id="checks-heading">What we check</h2><ul><li>Every number against its source</li><li>Every year against the calendar</li></ul></section>',
    );
    expect(html).toContain('<p>Run the numbers in <a href="/calculator">the calculator</a>.</p>');
    expect(html).toContain('<h2 id="fixes-heading">Corrections</h2><p>Write to fixes@example.com.</p></section>');
    expect(html).toContain('<a href="mailto:fixes@example.com">fixes@example.com</a>');
    expect(html).not.toContain(createContext().messages.method.factsBody.replaceAll("'", "&#x27;"));
  });

  it("keeps the AI disclosure first and adds neither of the package's \"who\" texts", () => {
    const context = createContext({ aiDisclosure: true });
    const copy = context.messages.method;
    const html = renderToStaticMarkup(<BlogMethodView context={context} sections={SECTIONS} />);
    expect(readSectionIds(html)).toEqual(["ai", "checks", "calculator", "fixes", "contact"]);
    expect(html).toContain(`<h2 id="ai-heading">${copy.aiTitle}</h2><p>${copy.aiBody}</p>`);
    expect(html).not.toContain(copy.whoBody.replaceAll("'", "&#x27;"));
    expect(html).not.toContain(copy.whoBodyAi.replaceAll("'", "&#x27;"));
  });

  it("closes the page with the footer note after the app's sections", () => {
    const context = createContext();
    const html = renderToStaticMarkup(<BlogMethodView context={context} sections={SECTIONS} />);
    const disclaimer = html.indexOf(`aria-label="${context.messages.pages.disclaimerLabel}"`);
    expect(disclaimer).toBeGreaterThan(html.lastIndexOf("</section>"));
    expect(html).toContain("Example editorial team");
    expect(html).toContain("<p>Not investment advice.</p>");
  });

  it("leaves no section from an empty list but the AI disclosure", () => {
    expect(readSectionIds(renderToStaticMarkup(<BlogMethodView context={createContext()} sections={[]} />))).toEqual([]);
    expect(readSectionIds(renderToStaticMarkup(<BlogMethodView context={createContext({ aiDisclosure: true })} sections={[]} />))).toEqual(["ai"]);
  });

  it("renders the default sections without sections", () => {
    expect(readSectionIds(renderToStaticMarkup(<BlogMethodView context={createContext()} />))).toEqual(DEFAULT_IDS);
    expect(readSectionIds(renderToStaticMarkup(<BlogMethodView context={createContext({ aiDisclosure: true })} />))).toEqual(["ai", ...DEFAULT_IDS]);
  });
});
