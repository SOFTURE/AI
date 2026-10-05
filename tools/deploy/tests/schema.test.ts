import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderDeployJsonSchema, SCHEMA_FILE } from "../scripts/write-schema.js";
import { DEPLOY_SCHEMA_URL } from "../src/verify/schema.js";

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasDescription(schema: unknown): boolean {
  return isSchemaObject(schema) && typeof schema.description === "string" && schema.description.trim().length > 0;
}

/** The path of every key an app writes that has no description, anywhere in the schema. */
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

describe("schema/deploy.schema.json", () => {
  it("matches the zod schema; run `npm run schema -w @softure-ai/deploy` after changing it", () => {
    expect(readFileSync(SCHEMA_FILE, "utf8")).toBe(renderDeployJsonSchema());
  });

  it("is published under its unpkg URL", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_FILE, "utf8")) as Record<string, unknown>;
    expect(schema.$id).toBe(DEPLOY_SCHEMA_URL);
  });

  it("describes every key an app writes", () => {
    expect(findUndescribedKeys(JSON.parse(readFileSync(SCHEMA_FILE, "utf8")))).toEqual([]);
  });
});
