import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readTextNodes } from "../support.js";

import { Code, CodeBlock } from "../../src/notion/Code.js";

function readClasses(html: string): string[] {
  return (html.match(/class="([^"]*)"/)?.[1] ?? "").split(" ");
}

describe("Code", () => {
  it("renders inline code in the code style, red on secondary", () => {
    const html = renderToStaticMarkup(<Code>npm ci</Code>);

    expect(html.startsWith('<code data-slot="code"')).toBe(true);
    expect(readClasses(html).sort()).toEqual(
      ["bg-secondary", "font-mono", "px-1", "rounded-xs", "text-code", "text-red"].sort(),
    );
    expect(readTextNodes(html)).toEqual(["npm ci"]);
  });

  it("lets the app's class override a default", () => {
    const html = renderToStaticMarkup(<Code className="text-blue">x</Code>);

    expect(readClasses(html)).toContain("text-blue");
    expect(readClasses(html)).not.toContain("text-red");
  });
});

describe("CodeBlock", () => {
  it("renders a scrolling mono block by default", () => {
    const html = renderToStaticMarkup(<CodeBlock>/var/log/app.log</CodeBlock>);

    expect(html.startsWith('<pre data-slot="code-block"')).toBe(true);
    expect(readClasses(html).sort()).toEqual(
      ["bg-muted", "font-mono", "overflow-x-auto", "px-4", "py-3", "rounded-lg", "text-code", "whitespace-pre"].sort(),
    );
    expect(html).not.toContain("data-wrap");
    expect(readTextNodes(html)).toEqual(["/var/log/app.log"]);
  });

  it("wraps long lines with wrap", () => {
    const html = renderToStaticMarkup(<CodeBlock wrap>line</CodeBlock>);
    const classes = readClasses(html);

    expect(classes).toContain("whitespace-pre-wrap");
    expect(classes).toContain("break-words");
    expect(classes).not.toContain("whitespace-pre");
    expect(html).toContain('data-wrap=""');
  });

  it("is a named, focusable region with a label", () => {
    const html = renderToStaticMarkup(<CodeBlock label="Build log">ok</CodeBlock>);

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Build log"');
    expect(html).toContain('tabindex="0"');
  });

  it("is plain, unfocusable text without a label", () => {
    const html = renderToStaticMarkup(<CodeBlock>ok</CodeBlock>);

    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-label");
    expect(html).not.toContain("tabindex");
  });
});
