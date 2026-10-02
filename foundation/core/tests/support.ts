// Small module definitions shared by the config tests. Each call builds a fresh factory.
import { defineModule, SoftureConfigError, type ModuleManifest } from "@softure-ai/core";

const en = { title: "Title" };
const pl: typeof en = { title: "PL" };

interface TestModuleSpec {
  readonly id: string;
  readonly version?: string;
  readonly dependsOn?: Record<string, string>;
  readonly dbSchema?: string | null;
  readonly routes?: Record<string, string>;
}

export function createTestModule(spec: TestModuleSpec) {
  const dbSchema = spec.dbSchema ?? null;
  const manifest: ModuleManifest = {
    id: spec.id,
    version: spec.version ?? "0.1.0",
    dependsOn: spec.dependsOn ?? {},
    dbSchema,
    tables: [],
    env: [],
    switches: [],
    routes: spec.routes ?? {},
    mount: [],
    privacy: { exports: false, deletes: false },
  };
  const migrations = dbSchema === null ? undefined : { dir: new URL(`./${spec.id}/migrations/`, import.meta.url) };
  return defineModule({ manifest, messages: { en, pl }, ...(migrations === undefined ? {} : { migrations }) })();
}

export function catchConfigError(run: () => unknown): SoftureConfigError {
  try {
    run();
  } catch (error) {
    if (error instanceof SoftureConfigError) return error;
    throw error;
  }
  throw new Error("expected a SoftureConfigError");
}
