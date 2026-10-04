// Stripe webhooks, pure: the `Stripe-Signature` check and the events billing acts on, narrowed with
// zod. Stripe signs `<timestamp>.<raw body>` with HMAC-SHA256 under the endpoint's secret
// (https://docs.stripe.com/webhooks#verify-manually); a timestamp older or newer than the tolerance
// is a replay and fails like a wrong signature. Nothing here touches the database.
import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { z } from "zod";
import { fromStripeAmount } from "./stripe-currency.js";

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
  /** What Stripe charged, in billing's unit (the pinned minor unit, converted from Stripe's). */
  readonly amount: number;
  /** ISO 4217, upper case. */
  readonly currency: string;
}

/** A refund Stripe reports as failed or canceled: its money is back with the customer's payment. */
export interface FailedRefund {
  /** The PaymentIntent id (`pi_...`) of the refunded payment. */
  readonly paymentId: string;
  /** The Refund id (`re_...`). */
  readonly refundId: string;
  /** What the refund was for, in billing's unit. */
  readonly amount: number;
  /** When Stripe created the refund. */
  readonly refundCreatedAt: Date;
  /** When Stripe reported the failure (the event's `created`). */
  readonly failedAt: Date;
}

/** What one delivery asks of billing. */
export type StripeWebhookEvent =
  /** A paid checkout: grant its plan, once. */
  | { readonly type: "checkout_paid"; readonly eventId: string; readonly checkout: PaidCheckout }
  /** A charge refunded in full: take back the access its payment gave, once. `snapshotAt`: when Stripe took the charge's state (the event's `created`). */
  | { readonly type: "payment_refunded"; readonly eventId: string; readonly paymentId: string; readonly snapshotAt: Date }
  /** A charge refunded in part: `amountRefunded` is the total refunded so far, in billing's unit, as of `snapshotAt`. */
  | {
      readonly type: "payment_partially_refunded";
      readonly eventId: string;
      readonly paymentId: string;
      readonly amountRefunded: number;
      readonly snapshotAt: Date;
    }
  /** A refund that failed (or was canceled): give back what it took, once per refund. */
  | { readonly type: "refund_failed"; readonly eventId: string; readonly failure: FailedRefund }
  /** Nothing to do: another event type, a checkout still waiting for its money, a charge with nothing refunded, a session billing did not create. */
  | { readonly type: "ignored"; readonly eventId: string; readonly reason: string };

const idSchema = z.string().min(1).max(MAX_ID_LENGTH);

/** Unix seconds, as Stripe dates every event and object (up to the end of year 9999). */
const unixSecondsSchema = z.number().int().min(0).max(253_402_300_799);

const envelopeSchema = z.object({
  id: idSchema,
  type: z.string().min(1).max(MAX_ID_LENGTH),
  /** When the event (and the snapshot of its object) was made; billing needs it for refunds only. */
  created: unixSecondsSchema.optional(),
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
  /** Stripe sends it on every charge; needed only for a partial refund, to convert the amount. */
  currency: z.string().regex(/^[a-zA-Z]{3}$/).optional(),
  /** The total refunded so far (Stripe sends it on every charge); needed only for a partial refund. */
  amount_refunded: z.number().int().min(0).optional(),
});

const refundSchema = z.object({
  id: idSchema,
  payment_intent: referenceSchema.nullish(),
  amount: z.number().int().min(0),
  currency: z.string().regex(/^[a-zA-Z]{3}$/),
  created: unixSecondsSchema,
  status: z.string().nullish(),
});

/** Refund statuses whose money went back to the payment: the refund took nothing in the end. */
const FAILED_REFUND_STATUSES: ReadonlySet<string> = new Set(["failed", "canceled"]);

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
  const currency = session.currency.toUpperCase();
  return {
    type: "checkout_paid",
    eventId,
    checkout: {
      checkoutId: session.id,
      paymentId: session.payment_intent ?? null,
      userId,
      planId,
      amount: fromStripeAmount(session.amount_total, currency),
      currency,
    },
  };
}

function fromUnixSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}

function readRefund(eventId: string, object: unknown, created: number | undefined): StripeWebhookEvent | null {
  const parsed = chargeSchema.safeParse(object);
  if (!parsed.success || created === undefined) return null;
  const paymentId = parsed.data.payment_intent;
  if (paymentId === null || paymentId === undefined) return { type: "ignored", eventId, reason: "a refunded charge without a payment" };
  const snapshotAt = fromUnixSeconds(created);
  if (parsed.data.refunded) return { type: "payment_refunded", eventId, paymentId, snapshotAt };
  const { amount_refunded: amountRefunded, currency } = parsed.data;
  if (amountRefunded === undefined || currency === undefined) return null;
  if (amountRefunded === 0) return { type: "ignored", eventId, reason: "a charge with nothing refunded" };
  return { type: "payment_partially_refunded", eventId, paymentId, amountRefunded: fromStripeAmount(amountRefunded, currency.toUpperCase()), snapshotAt };
}

/** A Refund event: `refund.failed` always reports a failure, the update events only with a failed or canceled status. */
function readFailedRefund(eventId: string, object: unknown, created: number | undefined, isFailure: boolean): StripeWebhookEvent | null {
  const parsed = refundSchema.safeParse(object);
  if (!parsed.success || created === undefined) return null;
  const refund = parsed.data;
  if (!isFailure && !FAILED_REFUND_STATUSES.has(refund.status ?? "")) {
    return { type: "ignored", eventId, reason: `a refund whose status is ${refund.status ?? "unknown"}` };
  }
  const paymentId = refund.payment_intent;
  if (paymentId === null || paymentId === undefined) return { type: "ignored", eventId, reason: "a failed refund without a payment" };
  const failure: FailedRefund = {
    paymentId,
    refundId: refund.id,
    amount: fromStripeAmount(refund.amount, refund.currency.toUpperCase()),
    refundCreatedAt: fromUnixSeconds(refund.created),
    failedAt: fromUnixSeconds(created),
  };
  return { type: "refund_failed", eventId, failure };
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
  const { id, type, data, created } = envelope.data;
  let event: StripeWebhookEvent | null;
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      event = readCheckout(id, data.object);
      break;
    case "charge.refunded":
      event = readRefund(id, data.object, created);
      break;
    case "refund.failed":
      event = readFailedRefund(id, data.object, created, true);
      break;
    case "refund.updated":
    case "charge.refund.updated":
      event = readFailedRefund(id, data.object, created, false);
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
