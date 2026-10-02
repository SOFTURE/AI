// The container path: a bundled runner cannot find package folders (`import.meta.url` points at
// the bundle), so the build stage copies every enabled module's files to `<dir>/<module id>/` and
// the bundled runner reads them with `migrationsDir`. The ledger migration ships as code.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ok, type AnySoftureModule } from "@softure-ai/core";
import { LEDGER_MODULE_ID } from "./ledger.js";
import { prepareUnits, type MigrationStep } from "./migrator.js";
import type { MigrationResult } from "./problems.js";

/** Copies each module's migration files to `<targetDir>/<module id>/`, replacing older copies. */
export async function exportMigrations(
  modules: readonly AnySoftureModule[],
  targetDir: string,
): Promise<MigrationResult<MigrationStep[]>> {
  const units = await prepareUnits(modules, undefined);
  if (!units.ok) {
    return units;
  }
  const exported: MigrationStep[] = [];
  for (const unit of units.value.filter((candidate) => candidate.module !== LEDGER_MODULE_ID)) {
    const moduleDir = join(targetDir, unit.module);
    await rm(moduleDir, { recursive: true, force: true });
    await mkdir(moduleDir, { recursive: true });
    for (const file of unit.files) {
      await writeFile(join(moduleDir, file.fileName), file.sql, "utf8");
      exported.push({ module: unit.module, schema: unit.schema, version: file.version, name: file.name, checksum: file.checksum });
    }
  }
  return ok(exported);
}
