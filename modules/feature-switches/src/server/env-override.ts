// The environment override of a switch. It wins over the stored value, so an operator can undo a
// bad flip without the panel or the database.
import { getSwitchEnvName } from "../options.js";

export type Env = Readonly<Record<string, string | undefined>>;

export type EnvOverride =
  | { readonly kind: "unset" }
  | { readonly kind: "set"; readonly isEnabled: boolean }
  /** Set to something that is not a boolean: the switch falls back to its fail mode. */
  | { readonly kind: "invalid" };

const ON = new Set(["true", "1", "on"]);
const OFF = new Set(["false", "0", "off"]);
const reportedNames = new Set<string>();
const ignoredNames = new Set<string>();

/** Reads the override of `name`. An unreadable value is logged once, by variable name, never by value. */
export function readEnvOverride(name: string, env: Env): EnvOverride {
  const envName = getSwitchEnvName(name);
  const value = env[envName]?.trim().toLowerCase();
  if (value === undefined || value === "") return { kind: "unset" };
  if (ON.has(value)) return { kind: "set", isEnabled: true };
  if (OFF.has(value)) return { kind: "set", isEnabled: false };
  if (!reportedNames.has(envName)) {
    reportedNames.add(envName);
    console.error(`@softure-ai/feature-switches: ${envName} must be true, false, 1, 0, on or off; the switch uses its fail mode`);
  }
  return { kind: "invalid" };
}

/** Logs once, by variable name, that an override pointing away from the fail mode was ignored. */
export function reportIgnoredOverride(name: string, failValue: boolean): void {
  const envName = getSwitchEnvName(name);
  if (ignoredNames.has(envName)) return;
  ignoredNames.add(envName);
  console.error(
    `@softure-ai/feature-switches: ${envName} only moves the switch towards its fail mode (${failValue ? "on" : "off"}); the value is ignored`,
  );
}
