// Writes schema/deploy.schema.json from the zod schema (`npm run schema -w @softure-ai/deploy`).
// tests/schema.test.ts fails when the committed file and the schema disagree.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { getDeployJsonSchema } from "../src/verify/schema.js";

export const SCHEMA_FILE = join(import.meta.dirname, "..", "schema", "deploy.schema.json");

export function renderDeployJsonSchema(): string {
  return `${JSON.stringify(getDeployJsonSchema(), null, 2)}\n`;
}

if (process.argv[1] === import.meta.filename) {
  writeFileSync(SCHEMA_FILE, renderDeployJsonSchema());
  console.log(`wrote ${SCHEMA_FILE}`);
}
