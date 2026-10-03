// The Stripe adapter (https://docs.stripe.com/api/checkout/sessions/create): a one-time Checkout
// session per payment, paid on Stripe's page; the verified webhook (`stripeWebhookRoute` in
// `/next`) grants the plan once Stripe reports the money. Stripe's HTTP API through `fetch`, like
// mailing's `resend()`: no SDK, and tests inject `fetch`.
import { err, ok } from "@softure-ai/core";
import { CHECKOUT_PARAM, PLAN_FIELD, type CheckoutResult } from "./fields.js";
import type { PaymentContext, PaymentProvider, PaymentRequest } from "./payment.js";
import { getLocalizedText } from "./plans.js";
import { STRIPE_PROVIDER } from "./server/payments.js";
import { STRIPE_METADATA } from "./stripe-webhook.js";

export const STRIPE_API_BASE = "https://api.stripe.com";
export const STRIPE_SECRET_KEY_ENV = "STRIPE_SECRET_KEY";
/** How long the Checkout request may take before the buyer sees `billing.payment_failed`. */
export const STRIPE_TIMEOUT_MS = 10_000;

export interface StripeOptions {
  /**
   * The secret API key (`sk_test_...` in the sandbox). Default: `process.env.STRIPE_SECRET_KEY`,
   * read on every payment, so the configuration loads at build time without the secret.
   */
  readonly secretKey?: string;
  /** Default: `https://api.stripe.com`. For a proxy or a test server. */
  readonly apiBase?: string;
  /** Injected in tests; default: the global `fetch`. */
  readonly fetch?: typeof fetch;
}

function getReturnUrl(returnUrl: string, result: CheckoutResult, planId: string | null): string {
  const url = new URL(returnUrl);
  if (planId !== null) url.searchParams.set(PLAN_FIELD, planId);
  url.searchParams.set(CHECKOUT_PARAM, result);
  return url.toString();
}

/**
 * The form body of `POST /v1/checkout/sessions` for one payment of the plan: its price as a one-off
 * line item, the account in `client_reference_id` and the metadata the webhook reads (copied onto
 * the PaymentIntent, so the charge in Stripe's dashboard names the account too).
 */
export function getCheckoutSessionParams(ctx: Pick<PaymentContext, "config">, request: PaymentRequest): URLSearchParams {
  const { plan, account } = request;
  const { locale } = ctx.config;
  const params = new URLSearchParams({
    mode: "payment",
    locale,
    client_reference_id: account.id,
    customer_email: account.email,
    success_url: getReturnUrl(request.returnUrl, "success", null),
    cancel_url: getReturnUrl(request.returnUrl, "cancelled", plan.id),
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": plan.price.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(plan.price.amount),
    "line_items[0][price_data][product_data][name]": getLocalizedText(plan.name, locale),
    [`metadata[${STRIPE_METADATA.userId}]`]: account.id,
    [`metadata[${STRIPE_METADATA.planId}]`]: plan.id,
    [`payment_intent_data[metadata][${STRIPE_METADATA.userId}]`]: account.id,
    [`payment_intent_data[metadata][${STRIPE_METADATA.planId}]`]: plan.id,
  });
  if (plan.description !== undefined) params.set("line_items[0][price_data][product_data][description]", getLocalizedText(plan.description, locale));
  return params;
}

/** The hosted page's URL from Stripe's answer, or null when the answer has none. */
function readCheckoutUrl(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !Object.hasOwn(payload, "url")) return null;
  const url: unknown = (payload as Record<string, unknown>).url;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

/** Stripe's error type and code for the log; its message can echo the request back. */
function describeStripeError(payload: unknown): string {
  const error: unknown = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).error : null;
  if (typeof error !== "object" || error === null) return "no error body";
  const { type, code } = error as Record<string, unknown>;
  return [type, code].filter((part) => typeof part === "string").join("/") || "no error type";
}

/** `billing({ payment: stripe() })`: card, BLIK and transfer payments on Stripe Checkout. */
export function stripe(options: StripeOptions = {}): PaymentProvider {
  const apiBase = options.apiBase ?? STRIPE_API_BASE;
  return {
    name: STRIPE_PROVIDER,
    collectsInvoiceDetails: false,
    async startPayment(ctx, request) {
      const secretKey = (options.secretKey ?? process.env[STRIPE_SECRET_KEY_ENV] ?? "").trim();
      if (secretKey === "") {
        // A deployment without the key cannot take payments until it is set; never the buyer's fault.
        console.error(`@softure-ai/billing: stripe has no secret key; set ${STRIPE_SECRET_KEY_ENV} or pass stripe({ secretKey })`);
        return err("billing.payment_failed");
      }
      const fetchImpl = options.fetch ?? fetch;
      let response: Response;
      try {
        response = await fetchImpl(new URL("/v1/checkout/sessions", apiBase), {
          method: "POST",
          headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: getCheckoutSessionParams(ctx, request),
          signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
          cache: "no-store",
        });
      } catch (error) {
        // A timeout or a network failure: nothing was created that the buyer can pay.
        console.error(`@softure-ai/billing: the Stripe checkout for plan "${request.plan.id}" could not be created: ${error instanceof Error ? error.name : typeof error}`);
        return err("billing.payment_failed");
      }
      const payload: unknown = await response.json().catch(() => null);
      const url = response.ok ? readCheckoutUrl(payload) : null;
      if (url === null) {
        console.error(
          `@softure-ai/billing: Stripe refused the checkout for plan "${request.plan.id}" (HTTP ${String(response.status)}, ${response.ok ? "no checkout url" : describeStripeError(payload)})`,
        );
        return err("billing.payment_failed");
      }
      return ok({ type: "redirect", url });
    },
  };
}
