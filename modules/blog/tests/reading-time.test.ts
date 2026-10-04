// Reading time (FIRE_TRACKER `src/lib/blog-page.test.ts`, `getReadingMinutes`).
import { DEFAULT_WORDS_PER_MINUTE, getReadingMinutes } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const words = (count: number): string => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");

describe("getReadingMinutes", () => {
  it("rounds the words of prose up to whole minutes, at least one", () => {
    expect(DEFAULT_WORDS_PER_MINUTE).toBe(200);
    expect(getReadingMinutes("")).toBe(1);
    expect(getReadingMinutes(words(200))).toBe(1);
    expect(getReadingMinutes(words(201))).toBe(2);
  });

  it("leaves out footnote definitions, URLs and Markdown syntax", () => {
    const notes = Array.from({ length: 50 }, (_, index) => `[^n${index}]: ${words(10)} https://example.com/${index}`).join("\n");
    const body = `## ${words(100)}\n\n> ${words(100)}[^n0] https://example.com/a - * | #`;

    expect(getReadingMinutes(`${body}\n\n${notes}`)).toBe(1);
    expect(getReadingMinutes(`${body} extra\n\n${notes}`)).toBe(2);
  });

  it("takes another pace", () => {
    expect(getReadingMinutes(words(300), 100)).toBe(3);
  });
});
