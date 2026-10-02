// Runtime switches of the module (roadmap ID-3, unknown 3). Until `@softure-ai/feature-switches`
// exists, a switch is its declared default (an option) with an env override; ID-6 replaces this
// lookup and callers stay as they are.
import type { SoftureConfig } from "@softure-ai/core";
import { REGISTRATION_CLOSED_ENV } from "../index.js";
import { getAuthOptions } from "./options.js";

const ON = new Set(["true", "1"]);
const OFF = new Set(["false", "0"]);

/**
 * Whether registration is closed. The env override wins over the declared default; a value it
 * cannot read closes registration (fail closed) and is logged by name, never by value.
 */
export function isRegistrationClosed(config: SoftureConfig, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const override = env[REGISTRATION_CLOSED_ENV]?.trim().toLowerCase();
  if (override === undefined || override === "") return getAuthOptions(config).registrationClosed;
  if (ON.has(override)) return true;
  if (OFF.has(override)) return false;
  console.error(`@softure-ai/auth: ${REGISTRATION_CLOSED_ENV} must be true, false, 1 or 0; registration stays closed`);
  return true;
}
