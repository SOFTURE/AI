"use server";

// The billing server actions. Each reads the account from the session (never from a bound
// argument, which the client controls, docs/02 §8) before it reads the form: the payment action
// needs a signed-in account, the grant action the admin role. Unexpected failures become
// `safeError` codes. Next refuses an action whose Origin does not match the host.
import { authorizeRole, requireUser } from "@softure-ai/auth/next";
import { errorLogLabel, formatMessage, safeError, type CoreErrorCode } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { redirect } from "next/navigation";
import type { GrantFormState, PaymentFormState } from "../contract.js";
import { EMAIL_FIELD, INVOICE_FIELDS, PLAN_FIELD } from "../fields.js";
import { findPlan, getLocalizedText } from "../plans.js";
import { getBillingMessages, getBillingOptions, getBillingRoutes } from "../server/options.js";
import { findAccountByEmail, getBillingPlans, grantPlan, startPayment } from "../server/plans.js";
import { formatLastDay } from "../ui/format.js";
import { getBillingContext } from "./context.js";

/** Longer values are cut: the server functions refuse them anyway, and nothing huge is echoed back. */
const MAX_FIELD_LENGTH = 1024;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : "";
}

function reportFailure(operation: string, error: unknown): CoreErrorCode {
  console.error(`@softure-ai/billing: ${operation} failed: ${errorLogLabel(error)}`);
  return safeError(error).error;
}

/**
 * Starts paying for the plan of the form. Without a session it redirects to the login page and
 * back to the payment page. A hosted checkout is a redirect; a manual request answers `requested`.
 */
export async function startPaymentAction(_previous: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const config = getSoftureConfig();
  const user = await requireUser({ next: getBillingRoutes(config).payment });
  const planId = readText(formData, PLAN_FIELD);
  const invoice = { name: readText(formData, INVOICE_FIELDS.name), taxId: readText(formData, INVOICE_FIELDS.taxId), address: readText(formData, INVOICE_FIELDS.address) };
  const values = { [INVOICE_FIELDS.name]: invoice.name, [INVOICE_FIELDS.taxId]: invoice.taxId, [INVOICE_FIELDS.address]: invoice.address };

  let result;
  try {
    result = await startPayment(await getBillingContext(config), { account: { id: user.id, email: user.email }, planId, invoice });
  } catch (error) {
    return { status: "error", error: reportFailure("starting a payment", error), values };
  }
  if (!result.ok) return { status: "error", error: result.error, ...("fieldErrors" in result ? { fieldErrors: result.fieldErrors } : {}), values };
  // Outside the try: Next's redirect works by throwing.
  if (result.value.type === "redirect") redirect(result.value.url);
  return { status: "requested" };
}

/**
 * Grants one payment of a plan to the account with the form's email. Only for the role of
 * `billing({ adminRole })`, checked from the session before the form is read.
 */
export async function grantPlanAction(_previous: GrantFormState, formData: FormData): Promise<GrantFormState> {
  const config = getSoftureConfig();
  const admin = await authorizeRole(getBillingOptions(config).adminRole);
  if (!admin.ok) return { status: "error", error: admin.error };
  const email = readText(formData, EMAIL_FIELD).trim();
  const planId = readText(formData, PLAN_FIELD);
  const echo = { email, planId };

  const plan = findPlan(getBillingPlans(config), planId);
  if (plan === undefined) return { status: "error", error: "billing.plan_unknown", ...echo };
  let result;
  try {
    const ctx = await getBillingContext(config);
    const account = await findAccountByEmail(ctx, email);
    if (account === null) return { status: "error", error: "billing.account_unknown", ...echo };
    result = await grantPlan(ctx, account.id, plan.id);
    if (result.ok) {
      const messages = getBillingMessages(config).admin;
      const entitlement = result.value;
      const values = { email: account.email, plan: getLocalizedText(plan.name, config.locale) };
      const notice =
        entitlement.status === "paid" && entitlement.endsAt !== null
          ? formatMessage(messages.grantedUntil, { ...values, date: formatLastDay(entitlement.endsAt, config.locale, config.timezone) })
          : formatMessage(messages.granted, values);
      return { status: "granted", notice, planId };
    }
  } catch (error) {
    return { status: "error", error: reportFailure("granting a plan", error), ...echo };
  }
  // A plan grant always ends in the future; an account deleted meanwhile is unknown.
  return { status: "error", error: result.error === "billing.plan_unknown" ? "billing.plan_unknown" : "billing.account_unknown", ...echo };
}

