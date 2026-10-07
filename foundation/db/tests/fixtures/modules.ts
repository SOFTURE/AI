// Dummy modules for the migrator tests: `tags` depends on `notes` and references its table; `linked`
// references an app table (`public.app_users`), which the app's own migrations create.
// Tests that change files work on a copy of a fixture folder (`copyFixtureMigrations`).
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineModule, type AnySoftureModule, type ModuleManifest } from "@softure-ai/core";

const en = { title: "Title" };
const pl: typeof en = { title: "PL" };

export const FIXTURE_IDS = ["notes", "tags", "linked"] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];

interface FixtureModuleSpec {
  readonly id: string;
  readonly dbSchema?: string | null;
  readonly dependsOn?: Record<string, string>;
  readonly version?: string;
  readonly migrationsDir?: URL | null;
}

export function createFixtureModule(spec: FixtureModuleSpec): AnySoftureModule {
  const dbSchema = spec.dbSchema === undefined ? spec.id : spec.dbSchema;
  const manifest: ModuleManifest = {
    id: spec.id,
    version: spec.version ?? "0.1.0",
    dependsOn: spec.dependsOn ?? {},
    dbSchema,
    tables: [],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: false, deletes: false },
  };
  const migrations = spec.migrationsDir === null ? undefined : { dir: spec.migrationsDir ?? getFixtureMigrationsUrl(spec.id as FixtureId) };
  return defineModule({ manifest, messages: { en, pl }, ...(migrations === undefined ? {} : { migrations }) })();
}

export function getFixtureMigrationsUrl(id: FixtureId): URL {
  return new URL(`./${id}/migrations/`, import.meta.url);
}

export function createNotesModule(migrationsDir?: URL, version?: string): AnySoftureModule {
  return createFixtureModule({ id: "notes", ...(migrationsDir ? { migrationsDir } : {}), ...(version ? { version } : {}) });
}

export function createTagsModule(migrationsDir?: URL): AnySoftureModule {
  return createFixtureModule({ id: "tags", dependsOn: { notes: "^0.1.0" }, ...(migrationsDir ? { migrationsDir } : {}) });
}

export function createLinkedModule(): AnySoftureModule {
  return createFixtureModule({ id: "linked" });
}

/** A writable copy of a fixture folder; `cleanup` removes it. */
export function copyFixtureMigrations(id: FixtureId): { dir: URL; path: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), `softure-db-${id}-`));
  const path = join(root, "migrations");
  cpSync(fileURLToPath(getFixtureMigrationsUrl(id)), path, { recursive: true });
  return { dir: pathToFileURL(`${path}/`), path, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
