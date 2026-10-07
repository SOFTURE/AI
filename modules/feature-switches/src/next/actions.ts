"use server";

// The panel's server action. The role is checked first, from the session, before the form is read
// (never from a bound argument, which the client controls, docs/02 §8), so a refused caller learns
// nothing about the switches. Unexpected failures become `safeError` codes. A stored change revalidates the
// panel route (`routes.panel`), so the page re-renders every row's source note with the new date.
import { authorizeRole } from "@softure-ai/auth/next";
import { errorLogLabel, safeError } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SwitchFormState } from "../contract.js";
import { MAX_SWITCH_NAME_LENGTH } from "../options.js";
import { getFeatureSwitchesOptions, getFeatureSwitchesRoutes } from "../server/options.js";
import { setSwitch } from "../server/switches.js";
import { getSwitchContext } from "./context.js";

const setSwitchInput = z.object({
  name: z
    .string()
    .catch("")
    .transform((value) => value.slice(0, MAX_SWITCH_NAME_LENGTH + 1)),
  // A checked HTML checkbox sends "on" (or its value); an unchecked one sends nothing.
  enabled: z.string().nullable().catch(null),
});

/** Stores one switch's value for the panel's admin. */
export async function setSwitchAction(previous: SwitchFormState, formData: FormData): Promise<SwitchFormState> {
  const config = getSoftureConfig();
  const admin = await authorizeRole(getFeatureSwitchesOptions(config).panelRole);
  if (!admin.ok) return { status: "error", error: admin.error, isEnabled: previous.isEnabled };

  // Every field has a `catch`, so parsing cannot fail.
  const input = setSwitchInput.parse({ name: formData.get("name"), enabled: formData.get("enabled") });
  const isEnabled = input.enabled !== null;
  try {
    const result = await setSwitch(await getSwitchContext(config), { name: input.name, isEnabled, actorId: admin.value.id });
    if (!result.ok) return { status: "error", error: result.error, isEnabled: previous.isEnabled };
    revalidatePath(getFeatureSwitchesRoutes(config).panel);
    return { status: "ok", isEnabled };
  } catch (error) {
    console.error(`@softure-ai/feature-switches: setting a switch failed: ${errorLogLabel(error)}`);
    return { status: "error", error: safeError(error).error, isEnabled: previous.isEnabled };
  }
}
