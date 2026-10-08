// Content negotiation: which `Accept` headers ask for the Markdown version of a page.
import { prefersMarkdown } from "@softure-ai/seo";
import { describe, expect, it } from "vitest";

describe("prefersMarkdown", () => {
  it("prefers Markdown when the client names only text/markdown", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
  });

  it("prefers Markdown when it is named before HTML with a higher weight", () => {
    expect(prefersMarkdown("text/markdown, text/html;q=0.9, */*;q=0.8")).toBe(true);
  });

  it("prefers Markdown on a tie with HTML", () => {
    expect(prefersMarkdown("text/html, text/markdown")).toBe(true);
  });

  it("keeps HTML when HTML weighs more", () => {
    expect(prefersMarkdown("text/markdown;q=0.5, text/html")).toBe(false);
  });

  it("keeps HTML when a text/* range outweighs Markdown", () => {
    expect(prefersMarkdown("text/markdown;q=0.4, text/*;q=0.6")).toBe(false);
  });

  it("keeps HTML for a wildcard-only header (curl, crawlers, prefetches)", () => {
    expect(prefersMarkdown("*/*")).toBe(false);
  });

  it("keeps HTML for a browser's navigation header", () => {
    expect(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8")).toBe(false);
  });

  it("keeps HTML when Markdown is refused with q=0", () => {
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
  });

  it("keeps HTML without an Accept header", () => {
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown("")).toBe(false);
  });

  it("reads the header case-insensitively and skips malformed parts", () => {
    expect(prefersMarkdown("garbage, Text/Markdown; Q=1, text/html;q=abc")).toBe(true);
  });
});
