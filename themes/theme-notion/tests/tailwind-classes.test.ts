import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildThemeStylesheet } from "@softure-ai/theme-kit/build";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import { beforeAll, describe, expect, it } from "vitest";

import { NOTION_THEME, TONE_EDGE, TONE_FILL, TONE_TEXT } from "../src/index.js";
import { collectClassNames, type SlotClasses } from "./gallery/collect.js";
import { readSourceClassNames, readSourceClassStrings } from "./gallery/source-classes.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_FOLDERS = ["ui", "notion"].map((folder) => fileURLToPath(new URL(`../src/${folder}/`, import.meta.url)));

// Class names that are hooks for other selectors, not utilities: Tailwind's group and peer markers, and sonner's
// own `toaster` class. They generate no CSS by design.
const MARKER = /^(group|peer)(\/[\w-]+)?$|^toaster$/;

type DesignSystem = Awaited<ReturnType<typeof __unstable__loadDesignSystem>>;
let designSystem: DesignSystem;

beforeAll(async () => {
  // An app's Tailwind with the theme, as `theme.css` ships it (the default palette cleared, the animations imported).
  const css = `@import "tailwindcss" source(none);\n${buildThemeStylesheet({ theme: NOTION_THEME, sources: [], imports: ["tw-animate-css"] })}`;
  designSystem = await __unstable__loadDesignSystem(css, { base: PACKAGE_DIR });
});

/** The class names Tailwind generates no CSS for, markers left out. */
function findSilentClasses(names: Iterable<string>): string[] {
  const candidates = [...names].filter((name) => !MARKER.test(name)).sort();
  const css = designSystem.candidatesToCss(candidates);
  return candidates.filter((_, index) => css[index] === null);
}

describe("every class the components use generates CSS", () => {
  it("covers every class written in src/ui and src/notion", () => {
    expect(findSilentClasses(readSourceClassNames(SOURCE_FOLDERS))).toEqual([]);
  });

  it("covers every class in the rendered parity fixture", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures/notion-slots.json", import.meta.url), "utf8")) as Record<string, SlotClasses[]>;

    expect(findSilentClasses(collectClassNames(Object.values(fixture).flat()))).toEqual([]);
  });

  it("covers every tone's class names", () => {
    expect(findSilentClasses([...Object.values(TONE_TEXT), ...Object.values(TONE_FILL), ...Object.values(TONE_EDGE)])).toEqual([]);
  });

  it("reports a class that names no token or a cleared default colour", () => {
    expect(findSilentClasses(["bg-field", "bg-nowhere", "text-red-500", "group", "peer/menu-button"])).toEqual(["bg-nowhere", "text-red-500"]);
  });
});

describe("readSourceClassStrings", () => {
  it("reads className attributes and cn and cva arguments, not variant names or other strings", () => {
    const source = `const vVariants = cva("base", { variants: { size: { sm: "h-6" } }, defaultVariants: { size: "sm" } })
const label = "Not a class"
const PILL_CLASS = "rounded-full"
export const A = () => <div className="flex gap-1" title="Hi"><span className={cn("p-1", isOn && "p-2", side === "left" && "pl-1", vVariants({ size: "sm" }))} /></div>`;

    expect([...readSourceClassStrings(source, "a.tsx")].sort()).toEqual(["base", "flex gap-1", "h-6", "p-1", "p-2", "pl-1", "rounded-full"]);
  });
});
