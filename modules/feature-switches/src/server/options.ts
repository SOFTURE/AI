// The feature-switches options of the running app, read from the configuration in the module context.
import { getModule, type Locale, type SoftureConfig } from "@softure-ai/core";
import type { FeatureSwitchesOptions, SwitchDefinition } from "../options.js";

const MODULE_ID = "feature-switches";

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getFeatureSwitchesModule(config: SoftureConfig) {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/feature-switches: the module is not enabled; add featureSwitches({ ... }) to modules in softure.config.ts");
  }
  return module;
}

export function getFeatureSwitchesOptions(config: SoftureConfig): FeatureSwitchesOptions {
  // The module factory parsed these options with featureSwitchesOptionsSchema.
  return getFeatureSwitchesModule(config).options as FeatureSwitchesOptions;
}

/** Every switch the app declared, in its order. */
export function getSwitchDefinitions(config: SoftureConfig): readonly SwitchDefinition[] {
  return getFeatureSwitchesOptions(config).switches;
}

export function findSwitchDefinition(config: SoftureConfig, name: string): SwitchDefinition | undefined {
  return getSwitchDefinitions(config).find((definition) => definition.name === name);
}

/**
 * The definition of a switch code reads. Throws for an undeclared name: reading a mistyped switch is
 * a bug, and it must fail loudly instead of quietly reading as off.
 */
export function getSwitchDefinition(config: SoftureConfig, name: string): SwitchDefinition {
  const definition = findSwitchDefinition(config, name);
  if (definition === undefined) {
    throw new Error(`@softure-ai/feature-switches: switch "${name}" is not declared; add it to featureSwitches({ switches }) in softure.config.ts`);
  }
  return definition;
}

/** The text in `locale`, else in `en`, else `fallback`. */
export function getLocalizedText(text: Partial<Record<Locale, string>> | undefined, locale: Locale, fallback: string): string {
  return text?.[locale] ?? text?.en ?? fallback;
}
