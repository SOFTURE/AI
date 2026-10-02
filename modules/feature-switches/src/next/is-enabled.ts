// Switch reads for server components, actions and route handlers. React's `cache` reads every
// stored row once per request, however many components ask; nothing is cached across requests, so
// a flip is visible on the next request on every instance.
import { getSoftureConfig } from "@softure-ai/core/next";
import { cache } from "react";
import { getSwitchDefinition } from "../server/options.js";
import { readStoredSwitches, resolveSwitchValue, type StoredSwitches } from "../server/switches.js";
import { getSwitchContext } from "./context.js";

const getStoredSwitches = cache(async (): Promise<StoredSwitches> => readStoredSwitches(await getSwitchContext()));

/** Whether a declared switch is on. Throws for an undeclared name; a database failure gives the fail mode. */
export async function isEnabled(name: string): Promise<boolean> {
  const definition = getSwitchDefinition(getSoftureConfig(), name);
  return resolveSwitchValue(definition, await getStoredSwitches(), process.env).isEnabled;
}
