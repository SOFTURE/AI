import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderMarketingJsonSchema, SCHEMA_FILE } from "../scripts/write-schema.js";
import { loadMarketingConfig } from "../src/config/config.js";
import { MARKETING_SCHEMA_URL } from "../src/config/schema.js";

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasDescription(schema: unknown): boolean {
  return isSchemaObject(schema) && typeof schema.description === "string" && schema.description.trim().length > 0;
}

/**
 * The path of every key a project writes that has no description: each `properties` entry and each
 * record value (an object `additionalProperties`), anywhere in the schema, union branches included.
 */
function findUndescribedKeys(node: unknown, path = ""): string[] {
  if (Array.isArray(node)) return node.flatMap((item, index) => findUndescribedKeys(item, `${path}/${index}`));
  if (!isSchemaObject(node)) return [];
  const missing: string[] = [];
  if (isSchemaObject(node.properties)) {
    for (const [key, property] of Object.entries(node.properties)) {
      if (!hasDescription(property)) missing.push(`${path}/properties/${key}`);
    }
  }
  if (isSchemaObject(node.additionalProperties) && !hasDescription(node.additionalProperties)) missing.push(`${path}/additionalProperties`);
  return [...missing, ...Object.entries(node).flatMap(([key, child]) => findUndescribedKeys(child, `${path}/${key}`))];
}

function readSchemaFile(): Record<string, unknown> {
  return JSON.parse(readFileSync(SCHEMA_FILE, "utf8")) as Record<string, unknown>;
}

describe("schema/marketing.schema.json", () => {
  it("matches the zod schema; run `npm run schema -w @softure-ai/marketing-kit` after changing it", () => {
    expect(readFileSync(SCHEMA_FILE, "utf8")).toBe(renderMarketingJsonSchema());
  });

  it("names its published URL and refuses unknown top-level keys", () => {
    const schema = readSchemaFile() as { $id?: string; additionalProperties?: boolean; required?: string[] };
    expect(schema.$id).toBe(MARKETING_SCHEMA_URL);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["brand", "app", "voice", "videos"]);
  });

  it("describes the file and every key a project writes", () => {
    const schema = readSchemaFile();
    expect(hasDescription(schema)).toBe(true);
    expect(findUndescribedKeys(schema)).toEqual([]);
  });
});

describe("findUndescribedKeys", () => {
  it("passes keys and record values that carry a description", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string", description: "The name." } },
      additionalProperties: { type: "object", description: "One entry.", properties: { code: { type: "string", description: "The code." } } },
    };
    expect(findUndescribedKeys(schema)).toEqual([]);
  });

  it("reports a bare key, a blank description, a bare key inside a union branch and a bare record value by path", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        title: { type: "string", description: "  " },
        actions: {
          type: "array",
          description: "The actions.",
          items: { oneOf: [{ type: "object", properties: { do: { const: "tap", description: "Taps." } } }, { type: "object", properties: { do: { const: "hold" } } }] },
        },
        platforms: { type: "object", description: "Per platform.", additionalProperties: { type: "object" } },
        strict: { type: "object", description: "No other keys.", additionalProperties: false },
      },
    };
    expect(findUndescribedKeys(schema)).toEqual([
      "/properties/name",
      "/properties/title",
      "/properties/actions/items/oneOf/1/properties/do",
      "/properties/platforms/additionalProperties",
    ]);
  });
});

describe("the fixture's marketing.json", () => {
  it("validates, brand colours included", () => {
    const loaded = loadMarketingConfig(join(import.meta.dirname, "..", "examples", "fixture", "marketing.json"));
    expect(loaded.ok ? loaded.config.brand.colors : loaded.error).toEqual({
      background: "#0c0c0d",
      foreground: "#f2f3f5",
      muted: "#a3a6ad",
      accent: "#cff26b",
      cta: "#2dd4bf",
      onCta: "#0c0c0d",
      captionBackground: "#ecf1f7f7",
      captionText: "#0c0c0d",
      captionHighlight: "#0f766e",
    });
  });
});
