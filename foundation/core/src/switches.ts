// The switch-reader contract (docs/02-module-standard.md §3): a module asks a runtime switch by name
// without importing the module that stores switches. One enabled module provides the reader
// (`@softure-ai/feature-switches`); a module that asks falls back to its own default when no
// provider knows the switch.
import type { SoftureConfig } from "./config.js";
import type { ModuleContext } from "./module.js";

/** What a provider knows about a switch: its value, or nothing because the app did not define it. */
export type SwitchReading = { readonly kind: "value"; readonly isEnabled: boolean } | { readonly kind: "undeclared" };

/**
 * Reads one switch for the module that asks. It answers `undeclared` for a name the app did not
 * define, and resolves read failures itself (a fail mode), so a request never fails on a switch.
 */
export type SwitchReader = (context: ModuleContext, name: string) => Promise<SwitchReading>;

const UNDECLARED: SwitchReading = Object.freeze({ kind: "undeclared" });

/** The reader of the enabled module that provides one, or `null` when none does. */
export function findSwitchReader(config: SoftureConfig): SwitchReader | null {
  // `typeof`, not `!== null`: a module built by an older core has no such field at all.
  for (const module of config.modules) {
    if (typeof module.switchReader === "function") return module.switchReader;
  }
  return null;
}

/**
 * The value of a switch from the app's switch provider, or `undeclared` when the app has no
 * provider or did not define the switch there: the caller then uses its own default.
 */
export async function readSwitch(context: ModuleContext, name: string): Promise<SwitchReading> {
  const reader = findSwitchReader(context.config);
  return reader === null ? UNDECLARED : reader(context, name);
}
