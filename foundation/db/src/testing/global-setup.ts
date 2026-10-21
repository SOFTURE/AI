// A Vitest `globalSetup` module (issue #641): `test: { globalSetup: ["@softure-ai/db/testing/global-setup"] }`.
// It runs once in the main process before any worker starts and gives the run a template folder; workers inherit the
// variable, so `createTestDatabase` migrates each module set once per run instead of once per test file. The folder
// is removed when the run ends. A folder the app named itself (the variable already set) is kept.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEMPLATE_DIR_VARIABLE } from "./template-store.js";

export default async function setup(): Promise<() => Promise<void>> {
  const given = process.env[TEMPLATE_DIR_VARIABLE];
  if (given !== undefined && given !== "") {
    return () => Promise.resolve();
  }
  const dir = await mkdtemp(join(tmpdir(), "softure-db-templates-"));
  process.env[TEMPLATE_DIR_VARIABLE] = dir;
  return async () => {
    delete process.env[TEMPLATE_DIR_VARIABLE];
    await rm(dir, { recursive: true, force: true });
  };
}
