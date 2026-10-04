// Plans on the server: the configured list, granting a plan to an account (the one path the
// manual admin page and a provider's webhook take) and starting a payment through the provider.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import { consumeRateLimit, subjectKey } from "@softure-ai/security/server";
import { eq } from "drizzle-orm";
import type { BillingErrorCode, Entitlement, EntitlementEvent, PaymentErrorCode, PaymentGrant, Plan } from "../contract.js";
import { parseInvoiceDetails, type InvoiceDetailsError, type InvoiceInput } from "../invoice.js";
import type { InvoiceDetails, PaymentAccount, PaymentProvider, PaymentStart } from "../payment.js";
import { findPlan, getPlanGrant } from "../plans.js";
import { getPaymentGrant } from "../refund.js";
import { changeEntitlement, findEntitlementRecord, type BillingContext } from "./entitlements.js";
import { getBillingOptions, getBillingRoutes } from "./options.js";
import { claimHandOver, recordPaymentRequest, releaseHandOver } from "./requests.js";
import { isUserId } from "./user-id.js";
import { assertPaymentSetup, PAYMENT_BUCKET } from "./setup.js";

/** The plans of `billing({ plans })`, in their order. */
export function getBillingPlans(config: SoftureConfig): readonly Plan[] {
  return getBillingOptions(config).plans;
}

/** The provider of `billing({ payment })`. Throws when the app set none: a payment page without one is a bug. */
export function getPaymentProvider(config: SoftureConfig): PaymentProvider {
  const provider = getBillingOptions(config).payment;
  if (provider === undefined) throw new Error("@softure-ai/billing: billing({ payment }) is not set; the payment page needs a provider such as manual()");
  return provider;
}

/** The account with this email (compared trimmed and lower-cased, as auth stores it), or null. */
export async function findAccountByEmail(ctx: Pick<BillingContext, "db">, email: string): Promise<PaymentAccount | null> {
  const [row] = await ctx.db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

/** The account with this id, or null (also for an id that is not a uuid). */
export async function findAccountById(ctx: Pick<BillingContext, "db">, id: string): Promise<PaymentAccount | null> {
  if (!isUserId(id)) return null;
  const [row] = await ctx.db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, id));
  return row ?? null;
}

/** Where the account stands after a plan grant, and what the grant added (null when it added nothing). */
export interface AppliedPlan {
  readonly entitlement: Entitlement;
  readonly grant: PaymentGrant | null;
}

/**
 * `grantPlan` that also says what the grant added, for the payment row that pays for it. The event
 * is computed under the entitlement's lock and may be computed twice (a concurrent first change), so
 * the grant is taken from the last computation, the one applied.
 */
export async function applyPlan(ctx: BillingContext, userId: string, planId: string): Promise<Ok<AppliedPlan> | Err<BillingErrorCode | "billing.plan_unknown">> {
  const plan = findPlan(getBillingPlans(ctx.config), planId);
  if (plan === undefined) return err("billing.plan_unknown");
  let grant = null as PaymentGrant | null;
  const changed = await changeEntitlement(ctx, userId, (record, now): EntitlementEvent => {
    const event = getPlanGrant(record, plan, now, ctx.config.timezone);
    grant = getPaymentGrant(record, event, now);
    return event;
  });
  return changed.ok ? ok({ entitlement: changed.value, grant }) : changed;
}

/**
 * Grants one payment of the plan: a paid period that starts when the account's current access ends,
 * or lifetime access. Computed under the entitlement's lock, so two grants at once give two periods.
 * It records nothing: a grant made here is not in the account's history and cannot be revoked; an
 * admin's grant goes through `grantPlanManually`.
 */
export async function grantPlan(ctx: BillingContext, userId: string, planId: string): Promise<Ok<Entitlement> | Err<BillingErrorCode | "billing.plan_unknown">> {
  const applied = await applyPlan(ctx, userId, planId);
  return applied.ok ? ok(applied.value.entitlement) : applied;
}

export interface StartPaymentInput {
  readonly account: PaymentAccount;
  readonly planId: string;
  /** What the form sent; ignored when the provider collects its own details. */
  readonly invoice: InvoiceInput;
}

export type StartPaymentResult = Ok<PaymentStart> | Err<Exclude<PaymentErrorCode, "billing.invoice_details_invalid"> | "security.rate_limited"> | InvoiceDetailsError;

/**
 * Starts paying for a plan: counts `billing-payment` per account first, checks the plan, that the
 * account has no lifetime access yet and, for a provider that needs them, the invoice details, then
 * starts the provider. A provider that hands requests over (`handsOverRequests`, the manual adapter)
 * gets the request stored first and is called once per open request: asking again refreshes the
 * stored request and answers `requested` without a second hand-over, and a hand-over that failed
 * (an `Err` or a throw) is released, so the next ask tries again. Database errors and provider
 * throws propagate; a provider whose answer contradicts `handsOverRequests` throws.
 */
export async function startPayment(ctx: BillingContext, input: StartPaymentInput): Promise<StartPaymentResult> {
  assertPaymentSetup(ctx.config);
  const provider = getPaymentProvider(ctx.config);
  const limited = await consumeRateLimit(ctx, { bucket: PAYMENT_BUCKET, key: subjectKey(`account:${input.account.id}`) });
  if (!limited.ok) return err("security.rate_limited");

  const plan = findPlan(getBillingPlans(ctx.config), input.planId);
  if (plan === undefined) return err("billing.plan_unknown");
  const record = await findEntitlementRecord(ctx, input.account.id);
  if (record?.isLifetime === true) return err("billing.lifetime_active");
  let invoice: InvoiceDetails | null = null;
  if (provider.collectsInvoiceDetails) {
    const parsed = parseInvoiceDetails(input.invoice);
    if (!parsed.ok) return parsed;
    invoice = parsed.value;
  }
  const returnUrl = new URL(getBillingRoutes(ctx.config).payment, ctx.config.appOrigin).toString();
  const request = { plan, account: input.account, invoice, returnUrl };
  if (!provider.handsOverRequests) {
    const started = await provider.startPayment(ctx, request);
    if (started.ok && started.value.type === "requested") throw new Error(`@softure-ai/billing: provider "${provider.name}" answered requested but does not set handsOverRequests`);
    return started;
  }

  const requestId = await recordPaymentRequest(ctx, { userId: input.account.id, planId: plan.id, invoice, price: plan.price });
  const claimedAt = await claimHandOver(ctx, requestId);
  // Handed over before (asking again refreshed its details), or being handed over by a concurrent ask.
  if (claimedAt === null) return ok({ type: "requested" });
  let started: Awaited<ReturnType<PaymentProvider["startPayment"]>>;
  try {
    started = await provider.startPayment(ctx, request);
  } catch (error) {
    await releaseHandOver(ctx, requestId, claimedAt);
    throw error;
  }
  if (!started.ok) {
    await releaseHandOver(ctx, requestId, claimedAt);
    return started;
  }
  if (started.value.type !== "requested") throw new Error(`@softure-ai/billing: provider "${provider.name}" sets handsOverRequests but answered ${started.value.type}`);
  return started;
}
