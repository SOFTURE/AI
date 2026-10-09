import type { SourceFile } from "./source-files.js";

/** A colour written as a literal: a hex value or a CSS colour function. Colours belong to design tokens. */
export const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;

/** The lines that match `pattern`, as `file:line: text`; empty when none does. */
export function findLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  const linePattern = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  return files.flatMap(({ file, source }) =>
    source.split("\n").flatMap((line, index) => (linePattern.test(line) ? [`${file}:${String(index + 1)}: ${line.trim()}`] : [])),
  );
}

/** The lines that hold a raw colour literal ({@link RAW_COLOR}), as `file:line: text`. */
export function findRawColors(files: readonly SourceFile[]): string[] {
  return findLines(files, RAW_COLOR);
}

/**
 * The module specifiers a source imports or re-exports statically (`import … from`, `export … from`,
 * `import "…"`) and loads dynamically with a literal (`import("…")`), in source order.
 */
export function readImports(source: string): string[] {
  const pattern =
    /^\s*(?:import|export)\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+)\s*from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;
  return [...source.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
}
