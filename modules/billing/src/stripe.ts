// The Stripe adapter (https://docs.stripe.com/api/checkout/sessions/create): a one-time Checkout
// session per payment, paid on Stripe's page; the verified webhook (`stripeWebhookRoute` in
// `/next`) grants the plan once Stripe reports the money. Stripe's HTTP API through core's
// `requestJson` (a form body, no redirect followed): no SDK, and tests inject `fetch`.
import { err, ok, requestJson } from "@softure-ai/core";
import { z } from "zod";
import { CHECKOUT_PARAM, PLAN_FIELD, type CheckoutResult } from "./fields.js";
import type { PaymentContext, PaymentProvider, PaymentRequest } from "./payment.js";
import { getLocalizedText } from "./plans.js";
import { STRIPE_PROVIDER } from "./server/payments.js";
import { describeStripePriceProblem, toStripeAmount } from "./stripe-currency.js";
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
 * line item in Stripe's unit (`toStripeAmount`), the account in `client_reference_id` and the metadata the webhook reads (copied onto
 * the PaymentIntent, so the charge in Stripe's dashboard names the account too).
 */
export function getCheckoutSessionParams(ctx: Pick<PaymentContext, "config">, request: PaymentRequest): URLSearchParams {
  const { plan, account } = request;
  const { locale } = ctx.config;
  const unitAmount = toStripeAmount(plan.price);
  // The config refuses such a price (`checkPrice`) and `startPayment` checks it first.
  if (unitAmount === null) throw new Error(`@softure-ai/billing: stripe() cannot charge the price of plan "${plan.id}"`);
  const params = new URLSearchParams({
    mode: "payment",
    locale,
    client_reference_id: account.id,
    customer_email: account.email,
    success_url: getReturnUrl(request.returnUrl, "success", null),
    cancel_url: getReturnUrl(request.returnUrl, "cancelled", plan.id),
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": plan.price.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(unitAmount),
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

/** The part of Stripe's error answer the log may show; its `message` can echo the request back. */
const stripeErrorSchema = z.object({ error: z.object({ type: z.unknown(), code: z.unknown() }) });

/** Stripe's error type and code for the log, from the error answer read through `stripeErrorSchema`. */
function describeStripeError(errorBody: z.output<typeof stripeErrorSchema> | null): string {
  if (errorBody === null) return "no error body";
  const { type, code } = errorBody.error;
  return [type, code].filter((part) => typeof part === "string").join("/") || "no error type";
}

/** `billing({ payment: stripe() })`: card, BLIK and transfer payments on Stripe Checkout. */
export function stripe(options: StripeOptions = {}): PaymentProvider {
  const apiBase = options.apiBase ?? STRIPE_API_BASE;
  return {
    name: STRIPE_PROVIDER,
    collectsInvoiceDetails: false,
    handsOverRequests: false,
    checkPrice: describeStripePriceProblem,
    async startPayment(ctx, request) {
      const priceProblem = describeStripePriceProblem(request.plan.price);
      if (priceProblem !== null) {
        // Only a config built around billing({ ... }) gets here; the options schema refuses it.
        console.error(`@softure-ai/billing: plan "${request.plan.id}": ${priceProblem}`);
        return err("billing.payment_failed");
      }
      const secretKey = (options.secretKey ?? process.env[STRIPE_SECRET_KEY_ENV] ?? "").trim();
      if (secretKey === "") {
        // A deployment without the key cannot take payments until it is set; never the buyer's fault.
        console.error(`@softure-ai/billing: stripe has no secret key; set ${STRIPE_SECRET_KEY_ENV} or pass stripe({ secretKey })`);
        return err("billing.payment_failed");
      }
      const fetchImpl = options.fetch ?? fetch;
      const answer = await requestJson({
        url: new URL("/v1/checkout/sessions", apiBase),
        method: "POST",
        form: getCheckoutSessionParams(ctx, request),
        headers: { authorization: `Bearer ${secretKey}` },
        // Next.js may cache a server `fetch`; a checkout session is created once per payment.
        fetch: (input, init) => fetchImpl(input, { ...init, cache: "no-store" }),
        timeoutMs: STRIPE_TIMEOUT_MS,
        errorSchema: stripeErrorSchema,
      });
      if (!answer.ok && answer.status === null) {
        // A timeout or a network failure: nothing was created that the buyer can pay.
        console.error(`@softure-ai/billing: the Stripe checkout for plan "${request.plan.id}" could not be created: ${answer.error}`);
        return err("billing.payment_failed");
      }
      const url = answer.ok ? readCheckoutUrl(answer.value) : null;
      if (url === null) {
        const detail = answer.ok ? "no checkout url" : describeStripeError(answer.errorBody);
        console.error(`@softure-ai/billing: Stripe refused the checkout for plan "${request.plan.id}" (HTTP ${answer.ok ? "200" : String(answer.status)}, ${detail})`);
        return err("billing.payment_failed");
      }
      return ok({ type: "redirect", url });
    },
  };
}
