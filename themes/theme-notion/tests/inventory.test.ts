import { readdirSync, readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import * as theme from "../src/index.js";
import { CVA_AXES, GALLERY_CASES } from "./gallery/cases.js";

const SRC = new URL("../src/", import.meta.url);

function listFiles(folder: string, extension: RegExp): string[] {
  return readdirSync(new URL(`${folder}/`, SRC))
    .filter((name) => extension.test(name))
    .map((name) => name.replace(extension, ""))
    .sort();
}

const UI_FILES = listFiles("ui", /\.tsx$/);
// With their extensions: the compositions are .tsx, the helpers (tones, palette, icon stroke) .ts.
const NOTION_FILES = readdirSync(new URL("notion/", SRC)).sort();
const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const CASES_SOURCE = readFileSync(new URL("./gallery/cases.tsx", import.meta.url), "utf8");

// Parts an app never renders on its own: the overlay and portal wrappers the content parts render themselves.
const RENDERED_BY_THEIR_PARENT = new Set(["AlertDialogOverlay", "AlertDialogPortal", "DialogOverlay", "DialogPortal", "DropdownMenuPortal"]);

/** The cva variant axes declared in a ui file, by the cva's name. */
function readCvaAxes(source: string, fileName: string): Record<string, Record<string, string[]>> {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Record<string, Record<string, string[]>> = {};
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(file) === "cva") {
      const axes: Record<string, string[]> = {};
      const config = node.initializer.arguments[1];
      const variants = config !== undefined && ts.isObjectLiteralExpression(config) ? config.properties.find((property) => property.name?.getText(file) === "variants") : undefined;
      if (variants !== undefined && ts.isPropertyAssignment(variants) && ts.isObjectLiteralExpression(variants.initializer)) {
        for (const axis of variants.initializer.properties) {
          if (!ts.isPropertyAssignment(axis) || !ts.isObjectLiteralExpression(axis.initializer)) continue;
          axes[axis.name.getText(file)] = axis.initializer.properties.map((option) => (option.name?.getText(file) ?? "").replace(/^"|"$/g, ""));
        }
      }
      found[node.name.getText(file)] = axes;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe("the package inventory", () => {
  it("lists every shadcn file in the README, in order", () => {
    const sentence = /All (\d+) shadcn\/ui components of the design system, exported from the package root: ([^.]+)\./.exec(README.replace(/\s+/g, " "));
    const listed = (sentence?.[2] ?? "").split(", ").map((entry) => entry.replace(/ \(`\w+`\)$/, ""));

    expect([Number(sentence?.[1]), listed]).toEqual([UI_FILES.length, UI_FILES]);
  });

  it("names every composition file's components in the README and exports them", () => {
    const compositions = NOTION_FILES.flatMap((file) => {
      const source = readFileSync(new URL(`notion/${file}`, SRC), "utf8");
      return [...source.matchAll(/^export function ([A-Z]\w*)/gm)].map((match) => match[1] ?? "");
    });

    expect(compositions.length).toBeGreaterThan(0);
    for (const name of compositions) {
      expect([name, README.includes(`\`${name}\``), name in theme]).toEqual([name, true, true]);
    }
  });

  it("exports every value of every composition and helper file", async () => {
    for (const file of NOTION_FILES) {
      const module = (await import(`../src/notion/${file}`)) as Record<string, unknown>;
      for (const name of Object.keys(module)) expect([file, name, name in theme]).toEqual([file, name, true]);
    }
  });

  it("shows every exported component in the gallery", () => {
    const components = Object.entries(theme)
      .filter(([name, value]) => /^[A-Z][a-z]/.test(name) && (typeof value === "function" || (typeof value === "object" && value !== null && "$$typeof" in value)))
      .map(([name]) => name);
    const rendered = components.filter((name) => new RegExp(`<${name}[\\s>/]`).test(CASES_SOURCE));

    expect(components.filter((name) => !rendered.includes(name) && !RENDERED_BY_THEIR_PARENT.has(name))).toEqual([]);
  });

  it("draws every option of every cva in the gallery", () => {
    const declared = Object.assign({}, ...UI_FILES.map((file) => readCvaAxes(readFileSync(new URL(`ui/${file}.tsx`, SRC), "utf8"), file))) as Record<string, unknown>;
    expect(Object.fromEntries(Object.entries(CVA_AXES).map(([name, { axes }]) => [name, axes]))).toEqual(declared);

    for (const { component, axes } of Object.values(CVA_AXES)) {
      for (const [prop, values] of Object.entries(axes)) {
        for (const value of values) {
          const isDrawn = GALLERY_CASES.some((galleryCase) => galleryCase.component === component && galleryCase.options?.[prop] === value);
          expect([component, prop, value, isDrawn]).toEqual([component, prop, value, true]);
        }
      }
    }
  });
});
