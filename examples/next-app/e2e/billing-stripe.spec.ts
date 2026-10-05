// The Stripe webhook of @softure-ai/billing on the built app, with the test playing Stripe: it signs
// deliveries with the webhook secret Playwright gives the server (STRIPE_WEBHOOK_SECRET). A paid
// checkout turns the account's trial into paid access without the owner, a repeated delivery
// changes nothing, an unsigned one is refused, and a full refund takes back what that one payment
// granted: the access of a single payment, or one month of two stacked ones. The payment
// page shows where a hosted checkout returned. Stripe's own API is covered by the sandbox test in
// modules/billing/tests/stripe-sandbox.test.ts.
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { billingMessages, entitlements, payments, signStripePayload, STRIPE_METADATA, STRIPE_SIGNATURE_HEADER } from "@softure-ai/billing";
import { openPageAsNewClient, registerAccount, uniqueEmail } from "@softure-ai/testing/playwright";
import { eq, inArray } from "drizzle-orm";
import { openTestDatabase } from "./database.ts";
import { STRIPE_WEBHOOK_SECRET } from "./outbox.ts";

const authCopy = authMessages.en;
const copy = billingMessages.en;
const PASSWORD = "correct horse battery";
const WEBHOOK = "/api/billing/webhook";
const createdEmails: string[] = [];

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    // Entitlement and payment rows go with the accounts (ON DELETE CASCADE).
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

/** Registers a fresh account in `page` and returns its id. */
async function register(page: Page): Promise<string> {
  const email = uniqueEmail("e2e-stripe");
  createdEmails.push(email);
  await registerAccount(page, { copy: authCopy, email, password: PASSWORD });
  const database = await openTestDatabase();
  try {
    const [account] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account === undefined) throw new Error(`register: no account for ${email}`);
    return account.id;
  } finally {
    await database.close();
  }
}

/** A Stripe event around `object`, as Stripe delivers it. */
function stripeEvent(type: string, object: Record<string, unknown>): string {
  return JSON.stringify({ id: `evt_e2e_${randomUUID()}`, object: "event", type, created: Math.floor(Date.now() / 1000), data: { object } });
}

function paidCheckout(userId: string, checkoutId: string, paymentId: string): string {
  return stripeEvent("checkout.session.completed", {
    id: checkoutId,
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    payment_intent: paymentId,
    amount_total: 2900,
    currency: "pln",
    client_reference_id: userId,
    metadata: { [STRIPE_METADATA.userId]: userId, [STRIPE_METADATA.planId]: "monthly" },
  });
}

async function deliver(request: APIRequestContext, payload: string, secret = STRIPE_WEBHOOK_SECRET): Promise<number> {
  const header = signStripePayload({ payload, secret, timestamp: Math.floor(Date.now() / 1000) });
  const response = await request.post(WEBHOOK, { data: payload, headers: { "content-type": "application/json", [STRIPE_SIGNATURE_HEADER]: header } });
  return response.status();
}

async function readStatus(page: Page): Promise<string | null> {
  await page.goto("/account/billing");
  return page.locator("[data-status]").first().getAttribute("data-status");
}

async function countPayments(userId: string): Promise<number> {
  const database = await openTestDatabase();
  try {
    return (await database.db.select({ id: payments.id }).from(payments).where(eq(payments.userId, userId))).length;
  } finally {
    await database.close();
  }
}

test("a paid Stripe checkout turns the trial into paid access once, and a full refund takes it back", async ({ browser, request }) => {
  const page = await openPageAsNewClient(browser);
  const userId = await register(page);
  expect(await readStatus(page)).toBe("trial");

  const paymentId = `pi_e2e_${randomUUID().replaceAll("-", "")}`;
  const completed = paidCheckout(userId, `cs_e2e_${randomUUID().replaceAll("-", "")}`, paymentId);
  expect(await deliver(request, completed)).toBe(200);
  expect(await readStatus(page)).toBe("paid");
  await expect(page.locator("[data-status]").first()).toHaveText(new RegExp(`^${copy.badge.paid}until `));

  // Stripe retries until it sees a 2xx: the same delivery again changes nothing.
  expect(await deliver(request, completed)).toBe(200);
  expect(await countPayments(userId)).toBe(1);

  const refund = stripeEvent("charge.refunded", { id: "ch_e2e", object: "charge", payment_intent: paymentId, refunded: true });
  expect(await deliver(request, refund)).toBe(200);
  expect(await readStatus(page)).toBe("trial");
});

/** The account's dated paid end, and the end of the period each of its payments granted (by payment id). */
async function readPaidEnds(userId: string): Promise<{ paidUntil: Date | null; grantedUntil: Map<string | null, Date | null> }> {
  const database = await openTestDatabase();
  try {
    const [row] = await database.db.select({ paidUntil: entitlements.paidUntil }).from(entitlements).where(eq(entitlements.userId, userId));
    const rows = await database.db.select({ paymentId: payments.paymentId, grantedUntil: payments.grantedUntil }).from(payments).where(eq(payments.userId, userId));
    return { paidUntil: row?.paidUntil ?? null, grantedUntil: new Map(rows.map((payment) => [payment.paymentId, payment.grantedUntil])) };
  } finally {
    await database.close();
  }
}

test("a full refund of one of two stacked months takes back only that month", async ({ browser, request }) => {
  const page = await openPageAsNewClient(browser);
  const userId = await register(page);
  const firstPayment = `pi_e2e_${randomUUID().replaceAll("-", "")}`;
  const secondPayment = `pi_e2e_${randomUUID().replaceAll("-", "")}`;
  expect(await deliver(request, paidCheckout(userId, `cs_e2e_${randomUUID().replaceAll("-", "")}`, firstPayment))).toBe(200);
  expect(await deliver(request, paidCheckout(userId, `cs_e2e_${randomUUID().replaceAll("-", "")}`, secondPayment))).toBe(200);
  const stacked = await readPaidEnds(userId);
  expect(stacked.paidUntil).toEqual(stacked.grantedUntil.get(secondPayment));

  const refund = stripeEvent("charge.refunded", { id: "ch_e2e", object: "charge", payment_intent: secondPayment, refunded: true });
  expect(await deliver(request, refund)).toBe(200);
  expect(await readStatus(page)).toBe("paid");
  expect((await readPaidEnds(userId)).paidUntil).toEqual(stacked.grantedUntil.get(firstPayment));
});

test("the webhook refuses a delivery Stripe did not sign and grants nothing", async ({ browser, request }) => {
  const page = await openPageAsNewClient(browser);
  const userId = await register(page);
  const completed = paidCheckout(userId, `cs_e2e_${randomUUID().replaceAll("-", "")}`, `pi_e2e_${randomUUID().replaceAll("-", "")}`);

  expect(await deliver(request, completed, "whsec_forged")).toBe(400);
  expect((await request.post(WEBHOOK, { data: completed, headers: { "content-type": "application/json" } })).status()).toBe(400);
  expect(await countPayments(userId)).toBe(0);
  expect(await readStatus(page)).toBe("trial");
});

test("the payment page says where a hosted checkout returned", async ({ browser }) => {
  const page = await openPageAsNewClient(browser);
  await register(page);
  await page.goto("/payment?checkout=success");
  await expect(page.getByRole("status").filter({ hasText: copy.payment.checkoutSuccess })).toBeVisible();

  await page.goto("/payment?plan=monthly&checkout=cancelled");
  await expect(page.getByRole("status").filter({ hasText: copy.payment.checkoutCancelled })).toBeVisible();
  await expect(page.getByText(copy.payment.orderTitle)).toBeVisible();
});
