// The Stripe payment flow end to end without Stripe's network: the app (BILLING_PROVIDER=stripe, STRIPE_API_BASE on
// the fake Stripe of fake-stripe-server.mjs) creates a Checkout session, the buyer pays on the hosted page, the signed
// `checkout.session.completed` turns the trial into paid access, and a refund's `charge.refunded` takes it back. It
// runs in the `fake-stripe` project of playwright.config.ts on every e2e run; Stripe's real sandbox is checked every
// night (billing-checkout.stripe-sandbox.spec.ts, .github/workflows/stripe-sandbox.yml).
import { expect, test, type Page } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { billingMessages, payments } from "@softure-ai/billing";
import { openPageAsNewClient, uniqueEmail } from "@softure-ai/testing/playwright";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";
import { FAKE_STRIPE_ORIGIN, FAKE_STRIPE_SECRET_KEY } from "./fake-stripe.ts";

const copy = billingMessages.en;
const PASSWORD = "correct horse battery";
/** How long the webhook's effect may take to show on the account page. */
const DELIVERY_TIMEOUT_MS = 15_000;
const createdEmails: string[] = [];

/** What the fake Stripe recorded of a Checkout session (GET /v1/checkout/sessions/<id>). */
const sessionSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount_total: z.number(),
  currency: z.string(),
  client_reference_id: z.string(),
  customer_email: z.string(),
  payment_intent: z.string().nullable(),
});

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    // Entitlement and payment rows go with the account (ON DELETE CASCADE).
    for (const email of createdEmails) await database.db.delete(users).where(eq(users.email, email));
  } finally {
    await database.close();
  }
});

async function readStatus(page: Page): Promise<string | null> {
  await page.goto("/account/billing");
  return page.locator("[data-status]").first().getAttribute("data-status");
}

/** Calls the fake Stripe's API as the app does, with the test-mode key. */
async function callFakeStripe(path: string, form?: Record<string, string>): Promise<unknown> {
  const response = await fetch(new URL(path, FAKE_STRIPE_ORIGIN), {
    method: form === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${FAKE_STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    ...(form === undefined ? {} : { body: new URLSearchParams(form) }),
  });
  if (!response.ok) throw new Error(`callFakeStripe: ${path} answered ${String(response.status)}`);
  return response.json();
}

/** The PaymentIntent the account's one Stripe payment recorded. */
async function findPaymentIntent(userId: string): Promise<string> {
  const database = await openTestDatabase();
  try {
    const rows = await database.db.select({ paymentId: payments.paymentId }).from(payments).where(eq(payments.userId, userId));
    const paymentId = rows[0]?.paymentId;
    if (rows.length !== 1 || paymentId === null || paymentId === undefined) throw new Error(`findPaymentIntent: expected one Stripe payment for ${userId}, found ${String(rows.length)}`);
    return paymentId;
  } finally {
    await database.close();
  }
}

test("a payment on Stripe Checkout turns the trial into paid access, and a refund takes it back", async ({ browser }) => {
  const page = await openPageAsNewClient(browser);
  const email = uniqueEmail("e2e-fake-stripe");
  createdEmails.push(email);
  const userId = (await createSignedInAccount(page, { email, password: PASSWORD })).id;
  expect(await readStatus(page)).toBe("trial");

  await page.goto("/payment?plan=monthly");
  await page.getByRole("button", { name: copy.payment.checkout }).click();
  await page.waitForURL((url) => url.origin === FAKE_STRIPE_ORIGIN && url.pathname.startsWith("/c/pay/"));

  // The session the app created: the plan's price in its own currency, for this account.
  const sessionId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  const created = sessionSchema.parse(await callFakeStripe(`/v1/checkout/sessions/${sessionId}`));
  expect(created).toMatchObject({ status: "open", amount_total: 2900, currency: "pln", client_reference_id: userId, customer_email: email, payment_intent: null });
  await expect(page.locator("[data-amount]")).toHaveText("29.00 PLN");

  await page.getByRole("button", { name: "Pay" }).click();
  await page.waitForURL((url) => url.pathname === "/payment" && url.searchParams.get("checkout") === "success");
  await expect(page.getByRole("status").filter({ hasText: copy.payment.checkoutSuccess })).toBeVisible();
  await expect.poll(() => readStatus(page), { timeout: DELIVERY_TIMEOUT_MS }).toBe("paid");

  const paymentIntent = await findPaymentIntent(userId);
  expect(sessionSchema.parse(await callFakeStripe(`/v1/checkout/sessions/${sessionId}`)).payment_intent).toBe(paymentIntent);
  await callFakeStripe("/v1/refunds", { payment_intent: paymentIntent });
  await expect.poll(() => readStatus(page), { timeout: DELIVERY_TIMEOUT_MS }).toBe("trial");
  await page.context().close();
});
