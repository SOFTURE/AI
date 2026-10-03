// Plans on the server: the configured list, granting a plan to an account (the one path the
// manual admin page and a provider's webhook take) and starting a payment through the provider.
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import { consumeRateLimit, subjectKey } from "@softure-ai/security/server";
import { eq } from "drizzle-orm";
import type { BillingErrorCode, Entitlement, PaymentErrorCode, Plan } from "../contract.js";
import { INVOICE_FIELDS, INVOICE_LIMITS, type InvoiceField } from "../fields.js";
import type { InvoiceDetails, PaymentAccount, PaymentProvider, PaymentStart } from "../payment.js";
import { findPlan, getPlanGrant } from "../plans.js";
import { changeEntitlement, type BillingContext } from "./entitlements.js";
import { getBillingOptions, getBillingRoutes } from "./options.js";
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

/**
 * Grants one payment of the plan: a paid period that starts when the account's current access ends,
 * or lifetime access. Computed under the entitlement's lock, so two grants at once give two periods.
 */
export async function grantPlan(ctx: BillingContext, userId: string, planId: string): Promise<Ok<Entitlement> | Err<BillingErrorCode | "billing.plan_unknown">> {
  const plan = findPlan(getBillingPlans(ctx.config), planId);
  if (plan === undefined) return err("billing.plan_unknown");
  return changeEntitlement(ctx, userId, (record, now) => getPlanGrant(record, plan, now, ctx.config.timezone));
}

/** Invoice details as the form sent them, untrimmed. */
export interface InvoiceInput {
  readonly name: string;
  readonly taxId: string;
  readonly address: string;
}

export type InvoiceDetailsError = Err<"billing.invoice_details_invalid"> & { readonly fieldErrors: Readonly<Partial<Record<InvoiceField, "billing.invoice_details_invalid">>> };

/** Trimmed invoice details, or the fields that are missing or too long. */
export function parseInvoiceDetails(input: InvoiceInput): Ok<InvoiceDetails> | InvoiceDetailsError {
  const name = input.name.trim();
  const taxId = input.taxId.trim();
  const address = input.address.trim();
  const fieldErrors: Partial<Record<InvoiceField, "billing.invoice_details_invalid">> = {};
  if (name === "" || name.length > INVOICE_LIMITS.name) fieldErrors[INVOICE_FIELDS.name] = "billing.invoice_details_invalid";
  if (taxId.length > INVOICE_LIMITS.taxId) fieldErrors[INVOICE_FIELDS.taxId] = "billing.invoice_details_invalid";
  if (address === "" || address.length > INVOICE_LIMITS.address) fieldErrors[INVOICE_FIELDS.address] = "billing.invoice_details_invalid";
  if (Object.keys(fieldErrors).length > 0) return { ...err("billing.invoice_details_invalid"), fieldErrors };
  return ok({ name, taxId: taxId === "" ? null : taxId, address });
}

export interface StartPaymentInput {
  readonly account: PaymentAccount;
  readonly planId: string;
  /** What the form sent; ignored when the provider collects its own details. */
  readonly invoice: InvoiceInput;
}

export type StartPaymentResult = Ok<PaymentStart> | Err<Exclude<PaymentErrorCode, "billing.invoice_details_invalid"> | "security.rate_limited"> | InvoiceDetailsError;

/**
 * Starts paying for a plan: counts `billing-payment` per account first, checks the plan and, for a
 * provider that needs them, the invoice details, then hands over to the provider. Database errors
 * and provider throws propagate.
 */
export async function startPayment(ctx: BillingContext, input: StartPaymentInput): Promise<StartPaymentResult> {
  assertPaymentSetup(ctx.config);
  const provider = getPaymentProvider(ctx.config);
  const limited = await consumeRateLimit(ctx, { bucket: PAYMENT_BUCKET, key: subjectKey(`account:${input.account.id}`) });
  if (!limited.ok) return err("security.rate_limited");

  const plan = findPlan(getBillingPlans(ctx.config), input.planId);
  if (plan === undefined) return err("billing.plan_unknown");
  let invoice: InvoiceDetails | null = null;
  if (provider.collectsInvoiceDetails) {
    const parsed = parseInvoiceDetails(input.invoice);
    if (!parsed.ok) return parsed;
    invoice = parsed.value;
  }
  const returnUrl = new URL(getBillingRoutes(ctx.config).payment, ctx.config.appOrigin).toString();
  return provider.startPayment(ctx, { plan, account: input.account, invoice, returnUrl });
}
