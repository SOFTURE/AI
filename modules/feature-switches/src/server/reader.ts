// The switch reader this module provides to `@softure-ai/core` (`readSwitch`): other modules, auth
// among them, read their switches through it without importing this module, which depends on them.
import type { ModuleContext, SoftureConfig, SwitchReader, SwitchReading } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { findSwitchDefinition, getSwitchDefinitions } from "./options.js";
import { readStoredSwitches, resolveSwitchValue } from "./switches.js";

/** A switch an enabled module names in its manifest that `featureSwitches({ switches })` does not define. */
export interface UndefinedManifestSwitch {
  readonly name: string;
  readonly moduleId: string;
}

/**
 * Reads a switch for another module: its value (override, stored row, default; the fail mode when
 * the row cannot be read), or `undeclared` for a name the app did not define, so the module asking
 * falls back to its own default. Reads the one row by name; never throws on a database failure.
 */
export const readDeclaredSwitch: SwitchReader = async (context: ModuleContext, name: string): Promise<SwitchReading> => {
  const definition = findSwitchDefinition(context.config, name);
  if (definition === undefined) return { kind: "undeclared" };
  // The reader runs with the asking module's context; every module that has a database gets the
  // shared Drizzle handle there (`@softure-ai/db`).
  const ctx = { ...context, db: context.db as Queryable };
  return { kind: "value", isEnabled: resolveSwitchValue(definition, await readStoredSwitches(ctx, [name]), process.env).isEnabled };
};

/**
 * The switches enabled modules name in their manifests (`module.json → switches`) that the app did
 * not define here, in module order. Each of those modules reads its own default instead.
 */
export function listUndefinedManifestSwitches(config: SoftureConfig): UndefinedManifestSwitch[] {
  const defined = new Set(getSwitchDefinitions(config).map((definition) => definition.name));
  return config.modules.flatMap((module) =>
    module.manifest.switches.filter((name) => !defined.has(name)).map((name) => ({ name, moduleId: module.id })),
  );
}
