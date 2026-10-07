// Shared setup: app configurations with the ops module and checks that pass, fail, throw or hang.
import { defineModule, defineSoftureConfig, err, ok, type HealthCheck, type SoftureConfig, type SoftureDatabaseConfig } from "@softure-ai/core";
import { ops, type OpsOptionsInput } from "@softure-ai/ops";

export const passingCheck: HealthCheck = () => Promise.resolve(ok());
export const failingCheck: HealthCheck = () => Promise.resolve(err("core.unexpected"));
export const throwingCheck: HealthCheck = () => Promise.reject(new TypeError("boom: secret detail"));
export const hangingCheck: HealthCheck = () => new Promise(() => undefined);

/** A module of the app that contributes a health check, as any SOFTURE module may. */
export function defineCheckedModule(id: string, health: HealthCheck) {
  return defineModule({
    manifest: {
      id,
      version: "0.1.0",
      dependsOn: {},
      dbSchema: null,
      tables: [],
      env: [],
      switches: [],
      routes: {},
      mount: [],
      privacy: { exports: false, deletes: false },
    },
    messages: { en: {}, pl: {} },
    health,
  });
}

export function createConfig(input: {
  readonly databaseUrl?: string | null;
  readonly databaseHandle?: SoftureDatabaseConfig["handle"];
  readonly modules?: readonly HealthCheck[];
  readonly ops?: OpsOptionsInput | null;
}): SoftureConfig {
  const checked = (input.modules ?? []).map((health, index) => defineCheckedModule(`module-${String(index + 1)}`, health)());
  return defineSoftureConfig({
    database:
      input.databaseUrl === null
        ? null
        : { url: input.databaseUrl ?? "pglite://", ...(input.databaseHandle === undefined ? {} : { handle: input.databaseHandle }) },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "http://localhost:3000",
    modules: input.ops === null ? checked : [...checked, ops(input.ops ?? {})],
  });
}
