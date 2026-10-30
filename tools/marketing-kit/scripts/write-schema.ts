// Writes schema/marketing.schema.json and schema/edl.schema.json from the zod schemas (`npm run schema -w @softure-ai/marketing-kit`).
// tests/schema.test.ts fails when the committed file and the schema disagree.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { getMarketingJsonSchema } from "../src/config/schema.js";
import { getEdlJsonSchema } from "../src/footage/edl.js";

export const SCHEMA_FILE = join(import.meta.dirname, "..", "schema", "marketing.schema.json");
export const EDL_SCHEMA_FILE = join(import.meta.dirname, "..", "schema", "edl.schema.json");

export function renderMarketingJsonSchema(): string {
  return `${JSON.stringify(getMarketingJsonSchema(), null, 2)}\n`;
}

export function renderEdlJsonSchema(): string {
  return `${JSON.stringify(getEdlJsonSchema(), null, 2)}\n`;
}

if (process.argv[1] === import.meta.filename) {
  writeFileSync(SCHEMA_FILE, renderMarketingJsonSchema());
  writeFileSync(EDL_SCHEMA_FILE, renderEdlJsonSchema());
  console.log(`wrote ${SCHEMA_FILE} and ${EDL_SCHEMA_FILE}`);
}
