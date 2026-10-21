// Migrated test templates on disk, shared by every test file and worker of one run (issue #641). The global setup
// (`@softure-ai/db/testing/global-setup`) gives the run a folder through an environment variable; without it nothing
// is written and each file migrates its own template, as before. A template is named by a hash of what it is built
// from (the module and drizzle files, the hooks' `templateKey`, the baseline), never by object identity, which means
// nothing in another process.
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnySoftureModule } from "@softure-ai/core";
import { getDrizzleFolder, getDrizzleLedger } from "../migrations/drizzle.js";
import type { AppMigrationHook, AppMigrations } from "../migrations/migrator.js";

/** The variable naming the run's template folder. Set by the global setup; an app may set it itself. */
export const TEMPLATE_DIR_VARIABLE = "SOFTURE_DB_TEST_TEMPLATES";

// Bumped when the stored format or the key changes, so a folder an app keeps across runs is not misread.
const STORE_VERSION = "1";

export interface TemplateSource {
  readonly modules: readonly AnySoftureModule[];
  readonly app: AppMigrations;
  readonly templateKey: string | undefined;
}

export function getTemplateDir(): string | null {
  const dir = process.env[TEMPLATE_DIR_VARIABLE];
  return dir === undefined || dir === "" ? null : dir;
}

/**
 * The name of a template on disk, or `null` when it cannot be identified across processes: an app hook other than
 * `drizzleAppMigrations` without a `templateKey`.
 */
export async function computeTemplateName(source: TemplateSource): Promise<string | null> {
  const parts = [`store:${STORE_VERSION}`];
  for (const module of source.modules) {
    const dir = module.migrations === null || module.migrations === undefined ? "-" : await hashFolder(fileURLToPath(module.migrations.dir));
    parts.push(`module:${module.id}:${dir}`);
  }
  for (const [phase, hook] of [["before", source.app.before], ["after", source.app.after]] as const) {
    const identity = await identifyHook(hook, source.templateKey);
    if (identity === null) {
      return null;
    }
    parts.push(`${phase}:${identity}`);
  }
  parts.push(`templateKey:${source.templateKey ?? "-"}`);
  const baseline = Object.entries(source.app.baseline ?? {}).sort(([left], [right]) => left.localeCompare(right));
  parts.push(`baseline:${baseline.map(([id, through]) => `${id}=${through}`).join(",")}`);
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/** The stored template, or `null` when this run has not written it yet. */
export async function readStoredTemplate(dir: string, name: string): Promise<Blob | null> {
  try {
    return new Blob([await readFile(join(dir, `${name}.tar`))]);
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw new Error(`createTestDatabase: reading the stored template ${name} in ${dir} failed`, { cause: error });
  }
}

/**
 * Writes the template under a temporary name and renames it, so a worker reading at the same time sees the whole
 * file or none. Two workers building the same template both write it; the second rename wins with identical bytes.
 */
export async function storeTemplate(dir: string, name: string, template: Blob): Promise<void> {
  const path = join(dir, `${name}.tar`);
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, new Uint8Array(await template.arrayBuffer()));
    await rename(temporary, path);
  } catch (error) {
    throw new Error(`createTestDatabase: storing the template ${name} in ${dir} failed`, { cause: error });
  }
}

async function identifyHook(hook: AppMigrationHook | undefined, templateKey: string | undefined): Promise<string | null> {
  if (hook === undefined) {
    return "-";
  }
  const folder = getDrizzleFolder(hook);
  if (folder !== undefined) {
    return `drizzle:${getDrizzleLedger(hook) ?? "-"}:${await hashFolder(folder)}`;
  }
  // A custom hook is a function: only the app can say which migrations it runs.
  return templateKey === undefined ? null : "custom";
}

// Every file under the folder, by relative path and content. A missing folder hashes as such: `migrate` reports it.
async function hashFolder(folder: string): Promise<string> {
  const hash = createHash("sha256");
  let entries;
  try {
    entries = await readdir(folder, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) {
      return "missing";
    }
    throw new Error(`createTestDatabase: reading the migrations folder ${folder} failed`, { cause: error });
  }
  const files = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)).sort();
  for (const file of files) {
    hash.update(`${relative(folder, file)}\0`);
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
