// The operator's read-only look at one account's billing: where it stands now, its trial's last
// day and its paid last day in the app's time zone, and lifetime access. An ops script
// (`@softure-ai/ops/scripts`) so it runs like the others, but it never writes: with or without
// `--commit` the report's `before` and `after` are the same reading. Reports carry the user id,
// never the email.
import { ok, systemClock, type SoftureConfig } from "@softure-ai/core";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { z } from "zod";
import { getDayNumber } from "../calendar.js";
import type { Entitlement } from "../contract.js";
import { resolveEntitlement } from "../entitlement.js";
import { findEntitlementRecord, type BillingContext } from "../server/entitlements.js";
import { getEntitlementPolicy } from "../server/options.js";
import { findAccountByEmail, findAccountById } from "../server/plans.js";
import { isUserId } from "../server/user-id.js";
import type { TrialScriptOptions } from "./trial-scripts.js";

/** Exactly one of `email` / `user`; `runOpsScript` checks it. */
export interface EntitlementStatusScriptArgs {
  readonly email?: string;
  /** The account id (`auth.users.id`). */
  readonly user?: string;
}

/** Where an account stands, as the status script reports it. */
export interface EntitlementStatusReport {
  readonly userId: string;
  readonly state: "trial" | "paid" | "lifetime" | "read_only";
  /** The trial's last day, `YYYY-MM-DD` in the app's time zone. */
  readonly trialLastDay: string;
  /** The last day of dated paid access, `YYYY-MM-DD` in the app's time zone; null when none was ever bought. */
  readonly paidLastDay: string | null;
  readonly isLifetime: boolean;
  readonly access: Entitlement;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_ACCOUNT = "no account has this email or id";

const statusArgs = z
  .strictObject({
    email: z.string().min(1, "--email needs an account email").optional(),
    user: z.string().min(1, "--user needs an account id").optional(),
  })
  .refine((args) => (args.email === undefined) !== (args.user === undefined), "give exactly one of --email=<account email> and --user=<account id>");

/** The local calendar day an end leaves as the last day of access, `YYYY-MM-DD`. */
function formatLastDay(end: Date, timezone: string): string {
  return new Date(getDayNumber(new Date(end.getTime() - 1), timezone) * DAY_MS).toISOString().slice(0, 10);
}

async function findAccountId(ctx: BillingContext, args: EntitlementStatusScriptArgs): Promise<string | null> {
  if (args.email !== undefined) return (await findAccountByEmail(ctx, args.email))?.id ?? null;
  if (args.user === undefined || !isUserId(args.user)) return null;
  return (await findAccountById(ctx, args.user))?.id ?? null;
}

function getState(access: Entitlement): EntitlementStatusReport["state"] {
  if (access.status === "paid" && access.endsAt === null) return "lifetime";
  return access.status;
}

/** `entitlement-status --email=…|--user=…`: prints where one account stands; writes nothing. */
export function createEntitlementStatusScript(config: SoftureConfig, options: TrialScriptOptions = {}): OpsScript<EntitlementStatusScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "entitlement-status",
    description: "Shows where one account stands: state, trial and paid last days in the app's time zone; writes nothing, even with --commit.",
    usage: ["--email=<account email> | --user=<account id>"],
    args: statusArgs,
    run: async (tx, args) => {
      const ctx: BillingContext = { db: tx, clock, config };
      const userId = await findAccountId(ctx, args);
      const record = userId === null ? null : await findEntitlementRecord(ctx, userId);
      if (userId === null || record === null) return refuseOpsScript(NO_ACCOUNT);
      const access = resolveEntitlement(record, clock.now(), getEntitlementPolicy(config));
      const status: EntitlementStatusReport = {
        userId,
        state: getState(access),
        trialLastDay: formatLastDay(record.trialEndsAt, config.timezone),
        paidLastDay: record.paidUntil === null ? null : formatLastDay(record.paidUntil, config.timezone),
        isLifetime: record.isLifetime,
        access,
      };
      return ok({ before: status, after: status });
    },
  });
}
