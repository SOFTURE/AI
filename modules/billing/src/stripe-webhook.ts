// Stripe webhooks, pure: the `Stripe-Signature` check and the events billing acts on, narrowed with
// zod. Stripe signs `<timestamp>.<raw body>` with HMAC-SHA256 under the endpoint's secret
// (https://docs.stripe.com/webhooks#verify-manually); a timestamp older or newer than the tolerance
// is a replay and fails like a wrong signature. Nothing here touches the database.
import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { z } from "zod";

/** The header Stripe signs every delivery with (lower case, as `Headers` returns it). */
export const STRIPE_SIGNATURE_HEADER = "stripe-signature";
/** How far a delivery's timestamp may be from now, in seconds: Stripe's default replay window. */
export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;
/** The metadata keys a checkout session carries (`stripe()` sets them). */
export const STRIPE_METADATA = { userId: "softure_user_id", planId: "softure_plan_id" } as const;

export type StripeWebhookError = "billing.webhook_invalid";

/** The longest id billing stores; Stripe's ids are far shorter. */
const MAX_ID_LENGTH = 255;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

function sign(secret: string, timestamp: number, payload: string): string {
  return createHmac("sha256", secret).update(`${String(timestamp)}.${payload}`, "utf8").digest("hex");
}

export interface SignStripePayloadInput {
  readonly payload: string;
  readonly secret: string;
  /** Unix seconds. */
  readonly timestamp: number;
}

/** A `Stripe-Signature` value as Stripe sends it, e.g. for a test that plays Stripe. */
export function signStripePayload({ payload, secret, timestamp }: SignStripePayloadInput): string {
  return `t=${String(timestamp)},v1=${sign(secret, timestamp, payload)}`;
}

export interface VerifyStripeSignatureInput {
  readonly payload: string;
  /** The `Stripe-Signature` header, or null when the request had none. */
  readonly header: string | null;
  readonly secret: string;
  readonly now: Date;
  readonly toleranceSeconds?: number;
}

/**
 * Whether Stripe signed `payload` with `secret` within the tolerance of `now`. Any `v1` entry may
 * match: Stripe sends one per secret while an old secret is still rolling off.
 */
export function verifyStripeSignature(input: VerifyStripeSignatureInput): Ok<undefined> | Err<StripeWebhookError> {
  const { payload, header, secret, now } = input;
  const tolerance = input.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  if (header === null || secret === "") return err("billing.webhook_invalid");

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t" && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    if (key === "v1" && SIGNATURE_PATTERN.test(value)) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return err("billing.webhook_invalid");
  if (Math.abs(Math.floor(now.getTime() / 1000) - timestamp) > tolerance) return err("billing.webhook_invalid");

  const expected = Buffer.from(sign(secret, timestamp, payload), "hex");
  const isSigned = signatures.some((signature) => timingSafeEqual(Buffer.from(signature, "hex"), expected));
  return isSigned ? ok() : err("billing.webhook_invalid");
}

/** A checkout Stripe reports as paid, with what `stripe()` put in its metadata. */
export interface PaidCheckout {
  /** The Checkout Session id (`cs_...`). */
  readonly checkoutId: string;
  /** The PaymentIntent id (`pi_...`) refunds name; null for a checkout without a charge. */
  readonly paymentId: string | null;
  readonly userId: string;
  readonly planId: string;
  /** What Stripe charged, in the currency's minor unit. */
  readonly amount: number;
  /** ISO 4217, upper case. */
  readonly currency: string;
}

/** What one delivery asks of billing. */
export type StripeWebhookEvent =
  /** A paid checkout: grant its plan, once. */
  | { readonly type: "checkout_paid"; readonly eventId: string; readonly checkout: PaidCheckout }
  /** A charge refunded in full: take back the access its payment gave, once. */
  | { readonly type: "payment_refunded"; readonly eventId: string; readonly paymentId: string }
  /** A charge refunded in part: `amountRefunded` is the total refunded so far, in the currency's minor unit. */
  | { readonly type: "payment_partially_refunded"; readonly eventId: string; readonly paymentId: string; readonly amountRefunded: number }
  /** Nothing to do: another event type, a checkout still waiting for its money, a charge with nothing refunded, a session billing did not create. */
  | { readonly type: "ignored"; readonly eventId: string; readonly reason: string };

const idSchema = z.string().min(1).max(MAX_ID_LENGTH);

const envelopeSchema = z.object({
  id: idSchema,
  type: z.string().min(1).max(MAX_ID_LENGTH),
  data: z.object({ object: z.unknown() }),
});

/** An expanded object or its id. */
const referenceSchema = z.union([idSchema, z.object({ id: idSchema })]).transform((value) => (typeof value === "string" ? value : value.id));

const sessionSchema = z.object({
  id: idSchema,
  mode: z.string(),
  payment_status: z.string(),
  payment_intent: referenceSchema.nullish(),
  amount_total: z.number().int().min(0).nullish(),
  currency: z.string().regex(/^[a-zA-Z]{3}$/).nullish(),
  metadata: z.record(z.string(), z.string()).nullish(),
});

const chargeSchema = z.object({
  payment_intent: referenceSchema.nullish(),
  refunded: z.boolean(),
  /** The total refunded so far (Stripe sends it on every charge); needed only for a partial refund. */
  amount_refunded: z.number().int().min(0).optional(),
});

/** Payment statuses of a checkout that has its money (`no_payment_required`: a 100% discount). */
const SETTLED_PAYMENT_STATUSES: ReadonlySet<string> = new Set(["paid", "no_payment_required"]);

function readCheckout(eventId: string, object: unknown): StripeWebhookEvent | null {
  const parsed = sessionSchema.safeParse(object);
  if (!parsed.success) return null;
  const session = parsed.data;
  const userId = session.metadata?.[STRIPE_METADATA.userId];
  const planId = session.metadata?.[STRIPE_METADATA.planId];
  if (session.mode !== "payment" || userId === undefined || planId === undefined) {
    return { type: "ignored", eventId, reason: "a checkout billing did not create" };
  }
  if (!SETTLED_PAYMENT_STATUSES.has(session.payment_status)) {
    // A delayed method (a bank transfer): `checkout.session.async_payment_succeeded` follows.
    return { type: "ignored", eventId, reason: `a checkout whose payment is ${session.payment_status}` };
  }
  if (session.amount_total === null || session.amount_total === undefined || session.currency === null || session.currency === undefined) return null;
  return {
    type: "checkout_paid",
    eventId,
    checkout: {
      checkoutId: session.id,
      paymentId: session.payment_intent ?? null,
      userId,
      planId,
      amount: session.amount_total,
      currency: session.currency.toUpperCase(),
    },
  };
}

function readRefund(eventId: string, object: unknown): StripeWebhookEvent | null {
  const parsed = chargeSchema.safeParse(object);
  if (!parsed.success) return null;
  const paymentId = parsed.data.payment_intent;
  if (paymentId === null || paymentId === undefined) return { type: "ignored", eventId, reason: "a refunded charge without a payment" };
  if (parsed.data.refunded) return { type: "payment_refunded", eventId, paymentId };
  const amountRefunded = parsed.data.amount_refunded;
  if (amountRefunded === undefined) return null;
  if (amountRefunded === 0) return { type: "ignored", eventId, reason: "a charge with nothing refunded" };
  return { type: "payment_partially_refunded", eventId, paymentId, amountRefunded };
}

/**
 * The event a verified payload carries. A body that is not a Stripe event, or an event billing acts
 * on whose object lacks what billing needs, is `billing.webhook_invalid`.
 */
export function parseStripeEvent(payload: string): Ok<StripeWebhookEvent> | Err<StripeWebhookError> {
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return err("billing.webhook_invalid");
  }
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) return err("billing.webhook_invalid");
  const { id, type, data } = envelope.data;
  let event: StripeWebhookEvent | null;
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      event = readCheckout(id, data.object);
      break;
    case "charge.refunded":
      event = readRefund(id, data.object);
      break;
    default:
      event = { type: "ignored", eventId: id, reason: `the event type ${type}` };
  }
  return event === null ? err("billing.webhook_invalid") : ok(event);
}

/** `verifyStripeSignature`, then `parseStripeEvent`: nothing unsigned is parsed. */
export function readStripeWebhook(input: VerifyStripeSignatureInput): Ok<StripeWebhookEvent> | Err<StripeWebhookError> {
  const verified = verifyStripeSignature(input);
  return verified.ok ? parseStripeEvent(input.payload) : verified;
}
