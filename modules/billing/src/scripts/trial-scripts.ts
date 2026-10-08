// The operator's way to extend a trial without the admin page: a safe ops script
// (`@softure-ai/ops/scripts`), dry run by default, `--commit` writes. It writes through
// `extendTrialManually` with no admin, so it has the admin form's refusals and records the same
// `billing.trial_extensions` row (`extended_by` null). The new end is a last day (`--until`, as in
// the form) or a number of days on top of the later of today and the current trial end (`--days`).
// Reports carry the user id, the trial end and the entitlement, never the email.
import { ok, systemClock, type Clock, type SoftureConfig } from "@softure-ai/core";
import { defineOpsScript, refuseOpsScript, type OpsScript } from "@softure-ai/ops/scripts";
import { z } from "zod";
import { getDayNumber, getStartOfDay, parseDay } from "../calendar.js";
import type { Entitlement } from "../contract.js";
import { findEntitlementRecord, getEntitlement, type BillingContext } from "../server/entitlements.js";
import { findAccountByEmail, findAccountById } from "../server/plans.js";
import { extendTrialManually } from "../server/trials.js";
import { isUserId } from "../server/user-id.js";

/** Exactly one of `email` / `user` and exactly one of `until` / `days`; `runOpsScript` checks it. */
export interface ExtendTrialScriptArgs {
  readonly email?: string;
  /** The account id (`auth.users.id`). */
  readonly user?: string;
  /** The trial's new last day, `YYYY-MM-DD` in the app's time zone. */
  readonly until?: string;
  /** Days on top of the later of today and the current trial end's day. */
  readonly days?: number;
}

export interface TrialScriptOptions {
  /** The time the extension is checked against and stored as `extended_at`; the system clock by default. */
  readonly clock?: Clock;
}

/** The most days one `--days` adds: a hundred years. */
export const MAX_EXTEND_DAYS = 36_500;

const WHOLE_NUMBER = /^\d+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const extendTrialArgs = z
  .strictObject({
    email: z.string().min(1, "--email needs an account email").optional(),
    user: z.string().min(1, "--user needs an account id").optional(),
    until: z
      .string()
      .refine((day) => parseDay(day) !== null, "--until must be a calendar day, YYYY-MM-DD")
      .optional(),
    days: z
      .string()
      .regex(WHOLE_NUMBER, `--days must be a whole number of days, 1 to ${String(MAX_EXTEND_DAYS)}`)
      .transform(Number)
      .pipe(z.number().int().min(1, "--days must be at least 1").max(MAX_EXTEND_DAYS, `--days must be at most ${String(MAX_EXTEND_DAYS)}`))
      .optional(),
  })
  .refine((args) => (args.email === undefined) !== (args.user === undefined), "give exactly one of --email=<account email> and --user=<account id>")
  .refine((args) => (args.until === undefined) !== (args.days === undefined), "give exactly one of --until=YYYY-MM-DD and --days=<number>");

const NO_ACCOUNT = "no account has this email or id";

interface TrialState {
  readonly userId: string;
  readonly trialEndsAt: Date;
  readonly access: Entitlement;
}

async function describeTrial(ctx: BillingContext, userId: string): Promise<TrialState | null> {
  const record = await findEntitlementRecord(ctx, userId);
  const access = await getEntitlement(ctx, userId);
  return record === null || access === null ? null : { userId, trialEndsAt: record.trialEndsAt, access };
}

async function findAccountId(ctx: BillingContext, args: ExtendTrialScriptArgs): Promise<string | null> {
  if (args.email !== undefined) return (await findAccountByEmail(ctx, args.email))?.id ?? null;
  if (args.user === undefined || !isUserId(args.user)) return null;
  return (await findAccountById(ctx, args.user))?.id ?? null;
}

/**
 * The trial's new end: the start of the day after `--until`, or the start of the day `--days` after
 * the later of today and the current end's day. Null when the arguments name neither.
 */
function getNewTrialEnd(ctx: BillingContext, args: ExtendTrialScriptArgs, current: Date): Date | null {
  const { timezone } = ctx.config;
  if (args.until !== undefined) {
    const lastDay = parseDay(args.until);
    return lastDay === null ? null : getStartOfDay(lastDay + 1, timezone);
  }
  if (args.days === undefined) return null;
  const baseDay = Math.max(getDayNumber(ctx.clock.now(), timezone), getDayNumber(current, timezone));
  return getStartOfDay(baseDay + args.days, timezone);
}

/** The local calendar day an end leaves as the last day of access, `YYYY-MM-DD`. */
function formatLastDay(end: Date, timezone: string): string {
  return new Date(getDayNumber(new Date(end.getTime() - 1), timezone) * DAY_MS).toISOString().slice(0, 10);
}

/** `extend-trial --email=…|--user=… --until=YYYY-MM-DD|--days=N`: extends one account's trial and records it. */
export function createExtendTrialScript(config: SoftureConfig, options: TrialScriptOptions = {}): OpsScript<ExtendTrialScriptArgs> {
  const clock = options.clock ?? systemClock;
  return defineOpsScript({
    name: "extend-trial",
    description: "Extends the trial of one account, recorded in its billing history; never writes paid access.",
    usage: [
      "--email=<account email> | --user=<account id>",
      "--until=<YYYY-MM-DD, the trial's new last day> | --days=<days on top of the later of today and the trial's end>",
    ],
    args: extendTrialArgs,
    run: async (tx, args) => {
      const ctx: BillingContext = { db: tx, clock, config };
      const userId = await findAccountId(ctx, args);
      const before = userId === null ? null : await describeTrial(ctx, userId);
      if (userId === null || before === null) return refuseOpsScript(NO_ACCOUNT);
      const until = getNewTrialEnd(ctx, args, before.trialEndsAt);
      // runOpsScript's schema requires one of them; a direct caller may pass neither.
      if (until === null) return refuseOpsScript("give exactly one of --until=YYYY-MM-DD and --days=<number>");
      const extended = await extendTrialManually(ctx, { userId, until, adminId: null });
      if (!extended.ok) {
        switch (extended.error) {
          case "billing.account_unknown":
            // Deleted between the lookup and the extension's lock.
            return refuseOpsScript(NO_ACCOUNT);
          case "billing.end_not_in_future":
            return refuseOpsScript(`the new last day ${formatLastDay(until, config.timezone)} has already passed`);
          case "billing.trial_not_extended":
            return refuseOpsScript(`the trial already lasts through ${formatLastDay(before.trialEndsAt, config.timezone)}; the new last day must be later`);
        }
      }
      const after = await describeTrial(ctx, userId);
      // The account was locked by the extension in this transaction.
      if (after === null) throw new Error("extend-trial: an account vanished after its trial was extended");
      return ok({ before, after: { ...after, extensionId: extended.value.extensionId } });
    },
  });
}
