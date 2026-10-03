// Runtime switches of the module. `auth.registration_closed` is read through the switch-reader
// contract of `@softure-ai/core`: when the app defines it in `@softure-ai/feature-switches`, the
// value stored in the switches panel applies. Otherwise auth falls back to its declared default (an
// option) with an env override, so an app without feature-switches keeps working.
import { readSwitch, type ModuleContext } from "@softure-ai/core";
import { REGISTRATION_CLOSED_ENV, REGISTRATION_CLOSED_SWITCH } from "../index.js";
import { getAuthOptions } from "./options.js";

const ON = new Set(["true", "1"]);
let hasReportedBadValue = false;
const OFF = new Set(["false", "0"]);

/**
 * Whether registration is closed. The app's switch provider answers first (env override, stored
 * value, default and fail mode as it defines them). Without one, the env override wins over the
 * declared default; a value it cannot read closes registration (fail closed) and is logged once, by
 * name, never by value.
 */
export async function isRegistrationClosed(ctx: ModuleContext, env: Readonly<Record<string, string | undefined>> = process.env): Promise<boolean> {
  const reading = await readSwitch(ctx, REGISTRATION_CLOSED_SWITCH);
  if (reading.kind === "value") return reading.isEnabled;
  const override = env[REGISTRATION_CLOSED_ENV]?.trim().toLowerCase();
  if (override === undefined || override === "") return getAuthOptions(ctx.config).registrationClosed;
  if (ON.has(override)) return true;
  if (OFF.has(override)) return false;
  if (!hasReportedBadValue) {
    hasReportedBadValue = true;
    console.error(`@softure-ai/auth: ${REGISTRATION_CLOSED_ENV} must be true, false, 1 or 0; registration stays closed`);
  }
  return true;
}
