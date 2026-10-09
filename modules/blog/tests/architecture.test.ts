// NFR-3 for the blog's markup and styles: no raw colours, no inline copy, Next only in the adapter,
// and a stylesheet rule for every class the components and the renderer write. The pages style
// themselves with `blog-*` classes from `styles.css`, on the --sft-* tokens only.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findInlineCopy, findRawColors, readSourceFiles, type SourceFile } from "@softure-ai/testing/guards";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "../src");
const STYLES = readFileSync(join(import.meta.dirname, "../styles.css"), "utf8");
const BLOG_CLASS = /\bblog-[a-z-]+/g;

/** The files directly in one folder of src/ (`""`: src/ itself). */
function readSources(dir: string): SourceFile[] {
  return readSourceFiles(SRC, { dirs: [dir], recursive: false });
}

/** Class names in `class="…"` (renderer HTML strings) and `className="…"` (components). */
function findClassNames(source: string): string[] {
  return [...source.matchAll(/class(?:Name)?=\\?"([^"\\]*)/g)].flatMap((match) => (match[1] ?? "").match(BLOG_CLASS) ?? []);
}

const markup = [...readSources("ui"), ...readSources("next")];

describe("blog markup and styles", () => {
  it("has components to check", () => {
    expect(markup.filter(({ file }) => file.endsWith(".tsx")).length).toBeGreaterThanOrEqual(5);
  });

  it("has no raw colour literal in markup or styles", () => {
    expect(findRawColors([...markup, { file: "styles.css", source: STYLES }])).toEqual([]);
  });

  it("has no inline copy: every visible and ARIA text comes from messages", () => {
    expect(findInlineCopy(markup)).toEqual([]);
  });

  it("keeps Next.js out of the components, the page logic, discovery and the proxy piece", () => {
    for (const { file, source } of [...readSources("ui"), ...readSources("pages"), ...readSources("discovery"), ...readSources("proxy")]) {
      expect(source, file).not.toMatch(/from "next(?:\/[a-z]+)?"/);
    }
  });

  it("reaches the optional @softure-ai/seo only through a dynamic import, and keeps the root entry off the Next adapter", () => {
    const sources = [...readSources(""), ...readSources("discovery"), ...readSources("cli"), ...readSources("server"), ...readSources("next")];
    for (const { file, source } of sources) expect(source, file).not.toMatch(/^import [^;]*from "@softure-ai\/seo/m);
    // softure.config.ts imports the root entry, and plain Node or a bundle outside Next loads it.
    for (const { file, source } of readSources("")) expect(source, file).not.toMatch(/(?:from|import\() *"(?:\.\/next\/|next\/)/);
  });

  it("keeps the command line off the Next adapter, so the bin runs without Next", () => {
    for (const { file, source } of readSources("cli")) expect(source, file).not.toMatch(/(?:from|import\() *"(?:\.\.\/next\/|next(?:\/[a-z]+)?")/);
  });

  it("keeps @softure-ai/seo out of the pages' code entirely, so an app without seo still builds them", () => {
    // A bundler resolves every import() it can reach; the pages ask core's getSiteUrls instead.
    for (const { file, source } of [...readSources("next"), ...readSources("pages"), ...readSources("ui")]) {
      expect(source, file).not.toContain('"@softure-ai/seo');
      expect(source, file).not.toMatch(/discovery\/submit/);
    }
  });

  it("styles every blog class the components and the renderer write", () => {
    // The views write their classes through the slot defaults (`BLOG_SLOT_CLASSES`), not as literals.
    const slotDefaults = readFileSync(join(SRC, "ui/class-names.ts"), "utf8").match(BLOG_CLASS) ?? [];
    const used = new Set([...[...markup, ...readSources("render")].flatMap(({ source }) => findClassNames(source)), ...slotDefaults]);
    expect(used.size).toBeGreaterThan(30);
    const missing = [...used].filter((name) => !new RegExp(`\\.${name}(?![a-z-])`).test(STYLES));
    expect(missing).toEqual([]);
  });

  it("keeps every rule in the softure layer, on tokens", () => {
    expect(STYLES.trimEnd().endsWith("}")).toBe(true);
    expect(STYLES.indexOf("@layer softure {")).toBeLessThan(STYLES.indexOf(".blog-"));
    expect(STYLES).toContain("var(--sft-color-foreground)");
  });
});
