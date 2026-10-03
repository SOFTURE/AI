"use server";

// The billing server actions. Each reads the account from the session (never from a bound
// argument, which the client controls, docs/02 §8) before it reads the form: the payment action
// needs a signed-in account, the admin actions the admin role. Unexpected failures become
// `safeError` codes. Next refuses an action whose Origin does not match the host. An admin action
// that changed something revalidates the admin page, so its lists show the change.
import type { AuthUser } from "@softure-ai/auth";
import { authorizeRole, requireUser } from "@softure-ai/auth/next";
import { errorLogLabel, formatMessage, safeError, type CoreErrorCode, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AdminActionErrorCode, AdminActionState, GrantFormState, PaymentFormState } from "../contract.js";
import { ACCOUNT_PARAM, EMAIL_FIELD, GRANT_FIELD, INVOICE_FIELDS, PLAN_FIELD, REQUEST_FIELD } from "../fields.js";
import { findPlan, getLocalizedText } from "../plans.js";
import { grantPaymentRequest, grantPlanManually, revokeManualGrant } from "../server/grants.js";
import { getBillingMessages, getBillingOptions, getBillingRoutes } from "../server/options.js";
import { findAccountByEmail, getBillingPlans, startPayment } from "../server/plans.js";
import type { BillingContext } from "../server/entitlements.js";
import { dismissPaymentRequest } from "../server/requests.js";
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

function refreshAdminPage(config: SoftureConfig): void {
  revalidatePath(getBillingRoutes(config).admin);
}

/** The signed-in admin, or the refusal: the role of `billing({ adminRole })`, from the session. */
async function authorizeAdmin(config: SoftureConfig): Promise<Ok<AuthUser> | Err<"auth.forbidden">> {
  return authorizeRole(getBillingOptions(config).adminRole);
}

/**
 * Grants one payment of a plan to the account with the form's email and records it in the
 * account's history. Only for the role of `billing({ adminRole })`, checked from the session
 * before the form is read. An account with lifetime access is refused.
 */
export async function grantPlanAction(_previous: GrantFormState, formData: FormData): Promise<GrantFormState> {
  const config = getSoftureConfig();
  const admin = await authorizeAdmin(config);
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
    result = await grantPlanManually(ctx, { userId: account.id, planId: plan.id, adminId: admin.value.id });
    if (result.ok) {
      refreshAdminPage(config);
      const messages = getBillingMessages(config).admin;
      const { entitlement } = result.value;
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
  // No request was given, so it is never closed; an account deleted meanwhile is unknown.
  const error = result.error === "billing.request_closed" ? "billing.account_unknown" : result.error;
  return { status: "error", error, ...echo };
}

interface AdminChange {
  readonly operation: string;
  /** The form field that names the row. */
  readonly field: string;
  readonly change: (ctx: BillingContext, id: string, adminId: string) => Promise<{ readonly ok: true } | Err<AdminActionErrorCode>>;
}

/** Runs one admin change on the row the form names: role first, then the change, then a refresh. */
async function runAdminChange(formData: FormData, { operation, field, change }: AdminChange): Promise<AdminActionState> {
  const config = getSoftureConfig();
  const admin = await authorizeAdmin(config);
  if (!admin.ok) return { status: "error", error: admin.error };
  const id = readText(formData, field);
  try {
    const result = await change(await getBillingContext(config), id, admin.value.id);
    if (!result.ok) return { status: "error", error: result.error };
  } catch (error) {
    return { status: "error", error: reportFailure(operation, error) };
  }
  refreshAdminPage(config);
  return { status: "done" };
}

/** Grants the plan of the form's open request and closes it (admin role). */
export async function grantRequestAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminChange(formData, {
    operation: "granting a payment request",
    field: REQUEST_FIELD,
    change: (ctx, requestId, adminId) => grantPaymentRequest(ctx, { requestId, adminId }),
  });
}

/** Closes the form's open request without a grant (admin role). */
export async function dismissRequestAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminChange(formData, { operation: "dismissing a payment request", field: REQUEST_FIELD, change: (ctx, requestId) => dismissPaymentRequest(ctx, requestId) });
}

/** Revokes the form's manual grant, taking back only what it added (admin role). */
export async function revokeGrantAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminChange(formData, {
    operation: "revoking a manual grant",
    field: GRANT_FIELD,
    change: (ctx, grantId, adminId) => revokeManualGrant(ctx, { grantId, adminId }),
  });
}

/**
 * Finds the account with the form's email and sends the admin to its history on the admin page,
 * by the account's id: an email address never lands in a URL (admin role).
 */
export async function findAccountAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const config = getSoftureConfig();
  const admin = await authorizeAdmin(config);
  if (!admin.ok) return { status: "error", error: admin.error };
  const email = readText(formData, EMAIL_FIELD).trim();
  let accountId;
  try {
    const account = await findAccountByEmail(await getBillingContext(config), email);
    if (account === null) return { status: "error", error: "billing.account_unknown", email };
    accountId = account.id;
  } catch (error) {
    return { status: "error", error: reportFailure("finding an account", error), email };
  }
  // Outside the try: Next's redirect works by throwing.
  redirect(`${getBillingRoutes(config).admin}?${new URLSearchParams({ [ACCOUNT_PARAM]: accountId }).toString()}`);
}

