// Stripe's webhook signature and the events billing acts on, pure.
import { parseStripeEvent, readStripeWebhook, signStripePayload, STRIPE_METADATA, verifyStripeSignature } from "@softure-ai/billing";
import { err, ok } from "@softure-ai/core";
import { describe, expect, it } from "vitest";
import { charge, checkoutSession, signature, stripeEvent, WEBHOOK_SECRET } from "./stripe-fixtures.js";
import { NOW } from "./support.js";

const USER_ID = "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";
const PAYLOAD = stripeEvent("checkout.session.completed", checkoutSession({ userId: USER_ID, planId: "monthly" }));
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

function verify(header: string | null, options: { payload?: string; secret?: string; now?: Date } = {}) {
  return verifyStripeSignature({ payload: options.payload ?? PAYLOAD, header, secret: options.secret ?? WEBHOOK_SECRET, now: options.now ?? NOW });
}

describe("verifyStripeSignature", () => {
  it("accepts the signature Stripe computes: HMAC-SHA256 of `t.payload`", () => {
    // HMAC-SHA256("whsec_x", "1.{}") in hex, computed apart from the module.
    expect(signStripePayload({ payload: "{}", secret: "whsec_x", timestamp: 1 })).toBe("t=1,v1=36ee2f7498f0c1777d1312b2a7361947fe5ad31223be30d0c62421f4ca753401");
    expect(verify(signature(PAYLOAD))).toEqual(ok());
  });

  it("accepts any v1 entry while a secret rotates, in any order, with spaces and unknown keys", () => {
    const valid = signature(PAYLOAD).split(",")[1];
    expect(verify(`t=${String(NOW_SECONDS)}, v0=abc, v1=${"0".repeat(64)}, ${String(valid)}`)).toEqual(ok());
  });

  it("accepts a delivery up to five minutes away from now, in either direction", () => {
    expect(verify(signature(PAYLOAD, { secondsAgo: 300 }))).toEqual(ok());
    expect(verify(signature(PAYLOAD, { secondsAgo: -300 }))).toEqual(ok());
  });

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["no timestamp", `v1=${"a".repeat(64)}`],
    ["no v1 signature", `t=${String(NOW_SECONDS)},v0=${"a".repeat(64)}`],
    ["a malformed signature", `t=${String(NOW_SECONDS)},v1=xyz`],
    ["a wrong signature", `t=${String(NOW_SECONDS)},v1=${"a".repeat(64)}`],
    ["a replay older than five minutes", signature(PAYLOAD, { secondsAgo: 301 })],
    ["a timestamp from the future", signature(PAYLOAD, { secondsAgo: -301 })],
    ["another secret", signature(PAYLOAD, { secret: "whsec_other" })],
  ])("refuses %s", (_case, header) => {
    expect(verify(header)).toEqual(err("billing.webhook_invalid"));
  });

  it("refuses a payload changed after signing, and an empty secret", () => {
    expect(verify(signature(PAYLOAD), { payload: `${PAYLOAD} ` })).toEqual(err("billing.webhook_invalid"));
    expect(verify(signature(PAYLOAD, { secret: "" }), { secret: "" })).toEqual(err("billing.webhook_invalid"));
  });
});

describe("parseStripeEvent", () => {
  it("reads a paid checkout with the account and plan from its metadata", () => {
    expect(parseStripeEvent(PAYLOAD)).toEqual(
      ok({
        type: "checkout_paid",
        eventId: "evt_test_checkout_session_completed",
        checkout: { checkoutId: "cs_test_a1", paymentId: "pi_test_a1", userId: USER_ID, planId: "monthly", amount: 2900, currency: "PLN" },
      }),
    );
  });

  it("reads a delayed payment that succeeded, and an expanded PaymentIntent", () => {
    const session = { ...checkoutSession({ userId: USER_ID, planId: "yearly", amount: 29000 }), payment_intent: { id: "pi_test_b2", object: "payment_intent" } };
    expect(parseStripeEvent(stripeEvent("checkout.session.async_payment_succeeded", session, "evt_2"))).toMatchObject(
      ok({ type: "checkout_paid", eventId: "evt_2", checkout: { paymentId: "pi_test_b2", planId: "yearly", amount: 29000 } }),
    );
  });

  it("reads a free checkout without a PaymentIntent", () => {
    const session = checkoutSession({ userId: USER_ID, planId: "monthly", paymentIntent: null, paymentStatus: "no_payment_required", amount: 0 });
    expect(parseStripeEvent(stripeEvent("checkout.session.completed", session))).toMatchObject(ok({ type: "checkout_paid", checkout: { paymentId: null, amount: 0 } }));
  });

  it("reads a full refund by its PaymentIntent", () => {
    expect(parseStripeEvent(stripeEvent("charge.refunded", charge("pi_test_a1", true), "evt_3"))).toEqual(
      ok({ type: "payment_refunded", eventId: "evt_3", paymentId: "pi_test_a1" }),
    );
  });

  it("reads a full refund that carries no amount, as the e2e sends it", () => {
    expect(parseStripeEvent(stripeEvent("charge.refunded", { payment_intent: "pi_test_a1", refunded: true }, "evt_3"))).toEqual(
      ok({ type: "payment_refunded", eventId: "evt_3", paymentId: "pi_test_a1" }),
    );
  });

  it("reads a partial refund with the total refunded so far", () => {
    expect(parseStripeEvent(stripeEvent("charge.refunded", charge("pi_test_a1", false, 1450), "evt_4"))).toEqual(
      ok({ type: "payment_partially_refunded", eventId: "evt_4", paymentId: "pi_test_a1", amountRefunded: 1450 }),
    );
  });

  it.each([
    ["a charge with nothing refunded", stripeEvent("charge.refunded", charge("pi_test_a1", false, 0))],
    ["a checkout still waiting for a transfer", stripeEvent("checkout.session.completed", checkoutSession({ userId: USER_ID, planId: "monthly", paymentStatus: "unpaid" }))],
    ["a subscription checkout", stripeEvent("checkout.session.completed", { ...checkoutSession({ userId: USER_ID, planId: "monthly" }), mode: "subscription" })],
    ["a checkout another app created", stripeEvent("checkout.session.completed", { ...checkoutSession({ userId: USER_ID, planId: "monthly" }), metadata: { order: "42" } })],
    ["a checkout without metadata", stripeEvent("checkout.session.completed", { ...checkoutSession({ userId: USER_ID, planId: "monthly" }), metadata: null })],
    ["a refunded charge without a PaymentIntent", stripeEvent("charge.refunded", { ...charge("pi_x", true), payment_intent: null })],
    ["another event type", stripeEvent("customer.created", { id: "cus_1" })],
  ])("ignores %s", (_case, payload) => {
    expect(parseStripeEvent(payload)).toMatchObject(ok({ type: "ignored" }));
  });

  it.each([
    ["not JSON", "{"],
    ["not an event", JSON.stringify({ hello: "world" })],
    ["a paid checkout without an amount", stripeEvent("checkout.session.completed", { ...checkoutSession({ userId: USER_ID, planId: "monthly" }), amount_total: null })],
    ["a checkout without an id", stripeEvent("checkout.session.completed", { ...checkoutSession({ userId: USER_ID, planId: "monthly" }), id: "" })],
    ["a refund without the refunded flag", stripeEvent("charge.refunded", { payment_intent: "pi_1" })],
    ["a partial refund without the amount refunded", stripeEvent("charge.refunded", { payment_intent: "pi_1", refunded: false })],
    ["a partial refund with a negative amount", stripeEvent("charge.refunded", charge("pi_test_a1", false, -1))],
  ])("refuses %s", (_case, payload) => {
    expect(parseStripeEvent(payload)).toEqual(err("billing.webhook_invalid"));
  });

  it("names the metadata keys stripe() sets", () => {
    expect(STRIPE_METADATA).toEqual({ userId: "softure_user_id", planId: "softure_plan_id" });
  });
});

describe("readStripeWebhook", () => {
  it("parses only a signed payload", () => {
    expect(readStripeWebhook({ payload: PAYLOAD, header: signature(PAYLOAD), secret: WEBHOOK_SECRET, now: NOW })).toMatchObject(ok({ type: "checkout_paid" }));
    expect(readStripeWebhook({ payload: "{", header: signature("{"), secret: WEBHOOK_SECRET, now: NOW })).toEqual(err("billing.webhook_invalid"));
    expect(readStripeWebhook({ payload: PAYLOAD, header: null, secret: WEBHOOK_SECRET, now: NOW })).toEqual(err("billing.webhook_invalid"));
  });
});
