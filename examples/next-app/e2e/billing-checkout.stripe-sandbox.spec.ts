// A real payment in Stripe's sandbox: the buyer pays the monthly plan on Stripe's hosted Checkout with
// the test card, Stripe's own `checkout.session.completed` reaches the app through `stripe listen`
// and turns the trial into paid access; a refund made through Stripe's API comes back as
// `charge.refunded` and takes it back. Run by playwright.stripe-sandbox.config.ts with a test-mode
// STRIPE_SECRET_KEY and the listener's STRIPE_WEBHOOK_SECRET (the `stripe-sandbox` job of
// .github/workflows/e2e.yml); skipped without the key. The signed fixtures of billing-stripe.spec.ts
// cover the webhook's cases without Stripe.
import { expect, test, type Page } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { billingMessages, payments } from "@softure-ai/billing";
import { openPageAsNewClient, uniqueEmail } from "@softure-ai/testing/playwright";
import { eq } from "drizzle-orm";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";

const SECRET_KEY = (process.env.STRIPE_SECRET_KEY ?? "").trim();
/** Never a live key: this test pays and refunds in the account it is given. */
const HAS_SANDBOX_KEY = SECRET_KEY.startsWith("sk_test_") || SECRET_KEY.startsWith("rk_test_");
const copy = billingMessages.en;
const PASSWORD = "correct horse battery";
/** Stripe's test card that pays without 3-D Secure. */
const TEST_CARD = { number: "4242424242424242", expiry: "12 / 34", cvc: "123", name: "Sandbox Buyer" };
/** How long Stripe's delivery may take to change the account (it can arrive before or after the redirect). */
const DELIVERY_TIMEOUT_MS = 60_000;
const createdEmails: string[] = [];

test.skip(!HAS_SANDBOX_KEY, "set STRIPE_SECRET_KEY to a test-mode key (sk_test_...) to pay in Stripe's sandbox");

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

/** Signs a fresh account in on `page` and returns its id. */
async function signIn(page: Page): Promise<string> {
  const email = uniqueEmail("e2e-stripe-sandbox");
  createdEmails.push(email);
  return (await createSignedInAccount(page, { email, password: PASSWORD })).id;
}

async function readStatus(page: Page): Promise<string | null> {
  await page.goto("/account/billing");
  return page.locator("[data-status]").first().getAttribute("data-status");
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

/** Refunds the whole PaymentIntent through Stripe's API, as the owner would in the dashboard. */
async function refundPayment(paymentIntent: string): Promise<void> {
  const response = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ payment_intent: paymentIntent }),
  });
  if (!response.ok) throw new Error(`refundPayment: Stripe answered ${String(response.status)} for ${paymentIntent}`);
}

/** Fills the card form of Stripe's hosted Checkout and pays. */
async function payWithTestCard(page: Page): Promise<void> {
  const cardNumber = page.locator("#cardNumber");
  // With BLIK or Przelewy24 enabled for PLN, Checkout lists the methods as an accordion; the card
  // form opens after its item.
  const cardItem = page.getByTestId("card-accordion-item-button");
  await expect(cardNumber.or(cardItem).first()).toBeVisible({ timeout: 30_000 });
  if (!(await cardNumber.isVisible()) && (await cardItem.isVisible())) await cardItem.click();
  await cardNumber.fill(TEST_CARD.number);
  await page.locator("#cardExpiry").fill(TEST_CARD.expiry);
  await page.locator("#cardCvc").fill(TEST_CARD.cvc);
  await page.locator("#billingName").fill(TEST_CARD.name);
  // The country defaults to the runner's location; Poland asks for no postal code.
  const country = page.locator("#billingCountry");
  if (await country.isVisible()) await country.selectOption("PL");
  const postalCode = page.locator("#billingPostalCode");
  if (await postalCode.isVisible()) await postalCode.fill("00-001");
  await page.getByTestId("hosted-payment-submit-button").click();
}

test("a payment on Stripe's sandbox Checkout turns the trial into paid access, and Stripe's refund takes it back", async ({ browser }) => {
  test.setTimeout(180_000);
  if ((process.env.STRIPE_WEBHOOK_SECRET ?? "").trim() === "") throw new Error("STRIPE_WEBHOOK_SECRET is not set: start `stripe listen` and pass its --print-secret");
  const page = await openPageAsNewClient(browser);
  const userId = await signIn(page);
  expect(await readStatus(page)).toBe("trial");

  await page.goto("/payment?plan=monthly");
  await page.getByRole("button", { name: copy.payment.checkout }).click();
  await page.waitForURL((url) => url.hostname === "checkout.stripe.com", { timeout: 30_000 });
  await payWithTestCard(page);

  await page.waitForURL((url) => url.pathname === "/payment" && url.searchParams.get("checkout") === "success", { timeout: 60_000 });
  await expect(page.getByRole("status").filter({ hasText: copy.payment.checkoutSuccess })).toBeVisible();
  await expect.poll(() => readStatus(page), { timeout: DELIVERY_TIMEOUT_MS, intervals: [1_000, 2_000] }).toBe("paid");

  await refundPayment(await findPaymentIntent(userId));
  await expect.poll(() => readStatus(page), { timeout: DELIVERY_TIMEOUT_MS, intervals: [1_000, 2_000] }).toBe("trial");
  await page.context().close();
});
