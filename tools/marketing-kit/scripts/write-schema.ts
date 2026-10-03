// Writes schema/marketing.schema.json from the zod schema (`npm run schema -w @softure-ai/marketing-kit`).
// tests/schema.test.ts fails when the committed file and the schema disagree.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { getMarketingJsonSchema } from "../src/config/schema.js";

export const SCHEMA_FILE = join(import.meta.dirname, "..", "schema", "marketing.schema.json");

export function renderMarketingJsonSchema(): string {
  return `${JSON.stringify(getMarketingJsonSchema(), null, 2)}\n`;
}

if (process.argv[1] === import.meta.filename) {
  writeFileSync(SCHEMA_FILE, renderMarketingJsonSchema());
  console.log(`wrote ${SCHEMA_FILE}`);
}
