// The container path: a bundled runner cannot find package folders (`import.meta.url` points at
// the bundle), so the build stage copies every enabled module's files to `<dir>/<module id>/` and
// the bundled runner reads them with `migrationsDir`. The ledger migration ships as code.
import type { Dirent } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ok, type AnySoftureModule } from "@softure-ai/core";
import { LEDGER_MODULE_ID } from "./ledger.js";
import { prepareUnits, type MigrationStep } from "./migrator.js";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";

/**
 * Copies each module's migration files to `<targetDir>/<module id>/`, replacing older `.sql`
 * copies. A module folder holding anything but `.sql` files is refused, never emptied: it is
 * not an earlier export (e.g. `softure migrate --export-migrations .` in an app with an `auth/`).
 */
export async function exportMigrations(
  modules: readonly AnySoftureModule[],
  targetDir: string,
): Promise<MigrationResult<MigrationStep[]>> {
  const units = await prepareUnits(modules, undefined);
  if (!units.ok) {
    return units;
  }
  const moduleUnits = units.value.filter((candidate) => candidate.module !== LEDGER_MODULE_ID);
  const problems: MigrationProblem[] = [];
  for (const unit of moduleUnits) {
    const foreign = (await listEntries(join(targetDir, unit.module))).filter((entry) => !entry.isFile() || !entry.name.endsWith(".sql"));
    if (foreign.length > 0) {
      problems.push({
        code: "db.export_target_not_empty",
        module: unit.module,
        dir: join(targetDir, unit.module),
        entries: foreign.map((entry) => entry.name).sort(),
      });
    }
  }
  if (problems.length > 0) {
    return failWith(problems);
  }

  const exported: MigrationStep[] = [];
  for (const unit of moduleUnits) {
    const moduleDir = join(targetDir, unit.module);
    for (const entry of await listEntries(moduleDir)) {
      await rm(join(moduleDir, entry.name));
    }
    await mkdir(moduleDir, { recursive: true });
    for (const file of unit.files) {
      await writeFile(join(moduleDir, file.fileName), file.sql, "utf8");
      exported.push({ module: unit.module, schema: unit.schema, version: file.version, name: file.name, checksum: file.checksum });
    }
  }
  return ok(exported);
}

async function listEntries(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
