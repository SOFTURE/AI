import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderMarketingJsonSchema, SCHEMA_FILE } from "../scripts/write-schema.js";
import { loadMarketingConfig } from "../src/config/config.js";
import { MARKETING_SCHEMA_URL } from "../src/config/schema.js";

describe("schema/marketing.schema.json", () => {
  it("matches the zod schema; run `npm run schema -w @softure-ai/marketing-kit` after changing it", () => {
    expect(readFileSync(SCHEMA_FILE, "utf8")).toBe(renderMarketingJsonSchema());
  });

  it("names its published URL and refuses unknown top-level keys", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_FILE, "utf8")) as { $id?: string; additionalProperties?: boolean; required?: string[] };
    expect(schema.$id).toBe(MARKETING_SCHEMA_URL);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["brand", "app", "voice", "videos"]);
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
