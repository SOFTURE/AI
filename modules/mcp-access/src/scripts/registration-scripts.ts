// The operator's way to open dynamic client registration for the minutes in which the owner adds
// the connector in an assistant, while `oauth.registration` is "closed" (#520): safe ops scripts
// (`@softure-ai/ops/scripts`), dry run by default, `--commit` writes. Reports carry only the end of
// the window.
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { defineOpsScript, refuseOpsScript, type OpsRefusal, type OpsScript } from "@softure-ai/ops/scripts";
import { z } from "zod";
import { getMcpAccessOptions } from "../server/options.js";
import {
  closeClientRegistration,
  findClientRegistrationWindow,
  MAX_REGISTRATION_WINDOW_MINUTES,
  openClientRegistration,
} from "../server/registration-window.js";
import type { McpAccessContext } from "../server/tokens.js";

export interface OpenClientRegistrationScriptArgs {
  readonly minutes: number;
}

export type CloseClientRegistrationScriptArgs = Readonly<Record<string, never>>;

export interface RegistrationScriptOptions {
  /** The time the window opens at; the system clock by default. */
  readonly clock?: Clock;
}

const WHOLE_NUMBER = /^\d+$/;
const MINUTES_MESSAGE = `--minutes must be a whole number from 1 to ${String(MAX_REGISTRATION_WINDOW_MINUTES)}`;

const openArgs = z.strictObject({
  minutes: z
    .string({ error: MINUTES_MESSAGE })
    .regex(WHOLE_NUMBER, MINUTES_MESSAGE)
    .transform(Number)
    .pipe(z.number().int().min(1, MINUTES_MESSAGE).max(MAX_REGISTRATION_WINDOW_MINUTES, MINUTES_MESSAGE)),
});

const closeArgs = z.strictObject({});

/** The refusal while the config gives the window nothing to do, or null when it does. */
function refuseWithoutClosedRegistration(config: SoftureConfig): OpsRefusal | null {
  const { oauth } = getMcpAccessOptions(config);
  if (!oauth.enabled) return refuseOpsScript("oauth.enabled is off: the OAuth routes answer 404");
  if (oauth.registration === "open") return refuseOpsScript('oauth.registration is "open": registration needs no window');
  return null;
}

async function describeWindow(ctx: McpAccessContext): Promise<{ openUntil: string | null }> {
  const window = await findClientRegistrationWindow(ctx);
  return { openUntil: window === null ? null : window.openUntil.toISOString() };
}

/** `open-client-registration --minutes=N`: opens dynamic client registration for N minutes (at most a day). */
export function createOpenClientRegistrationScript(
  config: SoftureConfig,
  options: RegistrationScriptOptions = {},
): OpsScript<OpenClientRegistrationScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "open-client-registration",
    description: "Opens OAuth dynamic client registration for the given minutes, replacing any open window.",
    usage: [`--minutes=<1 to ${String(MAX_REGISTRATION_WINDOW_MINUTES)}, how long registration stays open>`],
    args: openArgs,
    run: async (tx: Queryable, args) => {
      const refusal = refuseWithoutClosedRegistration(config);
      if (refusal !== null) return refusal;
      const ctx: McpAccessContext = { db: tx, clock, config };
      const before = await describeWindow(ctx);
      await openClientRegistration(ctx, { minutes: args.minutes });
      return ok({ before, after: await describeWindow(ctx) });
    },
  });
}

/** `close-client-registration`: closes dynamic client registration before its window ends. */
export function createCloseClientRegistrationScript(
  config: SoftureConfig,
  options: RegistrationScriptOptions = {},
): OpsScript<CloseClientRegistrationScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "close-client-registration",
    description: "Closes OAuth dynamic client registration before its open window ends.",
    usage: [],
    args: closeArgs,
    run: async (tx: Queryable) => {
      const refusal = refuseWithoutClosedRegistration(config);
      if (refusal !== null) return refusal;
      const ctx: McpAccessContext = { db: tx, clock, config };
      const before = await describeWindow(ctx);
      if (before.openUntil === null) return refuseOpsScript("client registration has no open window");
      await closeClientRegistration(ctx);
      return ok({ before, after: await describeWindow(ctx) });
    },
  });
}
