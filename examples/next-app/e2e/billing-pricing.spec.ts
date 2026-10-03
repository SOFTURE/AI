// Plans, the payment page and the manual adapter of @softure-ai/billing on the built app: the
// public pricing page lists the plans of softure.config.ts, choosing one asks a visitor to log in
// and comes back to it, an invoice request mails the admin and grants nothing, and the admin's
// grant at /admin/billing flips the account's trial to paid. Every test gets its own client
// address and accounts; the admin is an account given the role in Postgres (auth-roles.spec.ts
// owns the configured admin).
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { authMessages, userRoles, users } from "@softure-ai/auth";
import { billingMessages } from "@softure-ai/billing";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { eq, inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { EXAMPLE_ADMIN_EMAIL } from "../softure.config.ts";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX } from "./outbox.ts";

const authCopy = authMessages.en;
const copy = billingMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];

/** A fresh address per context (198.18.0.0/15), so the register bucket never fills up. */
function randomAddress(): string {
  return `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

function newEmail(): string {
  const email = `e2e-pricing-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

/** `Intl` puts no-break spaces between the parts of a price. */
function plain(text: string | null): string {
  return (text ?? "").replace(/[\u00a0\u202f]/g, " ");
}

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    // Entitlement and role rows go with the accounts (ON DELETE CASCADE).
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

async function openPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": randomAddress() } });
  return context.newPage();
}

async function register(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(authCopy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(authCopy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(authCopy.fields.consent).check();
  await page.getByRole("button", { name: authCopy.register.submit }).click();
  await expect(page).toHaveURL("/account");
}

/** An account with the admin role, granted in Postgres. */
async function registerAdmin(page: Page): Promise<void> {
  const email = newEmail();
  await register(page, email);
  const database = await openTestDatabase();
  try {
    const [account] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account === undefined) throw new Error(`registerAdmin: no account for ${email}`);
    await database.db.insert(userRoles).values({ userId: account.id, role: "admin", grantedAt: new Date() });
  } finally {
    await database.close();
  }
}

test("the pricing page lists the plans of the config, each linking to the payment page", async ({ browser }) => {
  const page = await openPage(browser);
  await page.goto("/pricing");
  const plans = page.getByRole("list", { name: copy.payment.plansLabel });
  await expect(plans.locator("[data-plan]")).toHaveCount(3);
  const monthly = plans.locator('[data-plan="monthly"]');
  expect(plain(await monthly.textContent())).toContain(`${en.plans.monthly.name}PLN 29.00per month`);
  await expect(plans.locator('[data-plan="yearly"]')).toContainText(copy.pricing.featured);
  expect(plain(await plans.locator('[data-plan="lifetime"]').textContent())).toContain("PLN 790.00one-time payment");
  await expect(page.getByRole("link", { name: `Choose ${en.plans.monthly.name}` })).toHaveAttribute("href", "/payment?plan=monthly");
});

test("choosing a plan without a session goes through the login page and back to the plan", async ({ browser }) => {
  const page = await openPage(browser);
  await page.goto("/pricing");
  await page.getByRole("link", { name: `Choose ${en.plans.yearly.name}` }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fpayment%3Fplan%3Dyearly$/);
});

test("an invoice request mails the admin the details and grants nothing yet", async ({ browser }) => {
  const page = await openPage(browser);
  const email = newEmail();
  await register(page, email);
  await page.goto("/account/billing");
  await page.getByRole("link", { name: en.billing.seePlans }).click();
  await expect(page).toHaveURL("/payment");
  await page.getByRole("link", { name: `Choose ${en.plans.yearly.name}` }).click();
  await expect(page).toHaveURL("/payment?plan=yearly");
  await expect(page.getByText(copy.payment.orderTitle)).toBeVisible();

  await page.getByLabel(copy.payment.fields.name).fill("Ada Lovelace Ltd");
  await page.getByLabel(copy.payment.fields.taxId).fill("PL1234567890");
  await page.getByLabel(copy.payment.fields.address).fill("1 Analytical Way, London");
  await page.getByRole("button", { name: copy.payment.requestInvoice }).click();
  await expect(page.getByRole("status").filter({ hasText: "Thank you!" })).toContainText(email);

  const mails = (await readMailOutbox(MAIL_OUTBOX, { to: EXAMPLE_ADMIN_EMAIL })).filter((mail) => mail.subject === `Invoice request: ${en.plans.yearly.name} for ${email}`);
  expect(mails).toHaveLength(1);
  expect(plain(mails[0]?.text ?? "")).toContain("Plan: Yearly, PLN 290.00\nName or company: Ada Lovelace Ltd\nTax ID: PL1234567890\nAddress: 1 Analytical Way, London");
  expect(mails[0]?.text).toContain("/admin/billing");

  await page.goto("/account/billing");
  await expect(page.locator("[data-status]").first()).toHaveAttribute("data-status", "trial");
});

test("the admin's grant flips the account's trial to paid", async ({ browser }) => {
  const member = await openPage(browser);
  const email = newEmail();
  await register(member, email);

  const admin = await openPage(browser);
  await registerAdmin(admin);
  await admin.goto("/admin");
  await admin.getByRole("link", { name: en.admin.grantPlans }).click();
  await expect(admin).toHaveURL("/admin/billing");
  await admin.getByLabel(copy.admin.email).fill(email);
  // The plan select starts on the first plan: Monthly.
  await admin.getByRole("button", { name: copy.admin.submit }).click();
  await expect(admin.getByRole("status").filter({ hasText: email })).toHaveText(new RegExp(`^${email.replace(/[.]/g, "\\.")} now has ${en.plans.monthly.name}, with access until `));

  await member.goto("/account/billing");
  const badge = member.locator("[data-status]").first();
  await expect(badge).toHaveAttribute("data-status", "paid");
  await expect(badge).toHaveText(new RegExp(`^${copy.badge.paid}until `));
});

test("the grant refuses an address without an account", async ({ browser }) => {
  const admin = await openPage(browser);
  await registerAdmin(admin);
  await admin.goto("/admin/billing");
  await admin.getByLabel(copy.admin.email).fill(`nobody-${randomUUID()}@example.com`);
  await admin.getByRole("button", { name: copy.admin.submit }).click();
  await expect(admin.getByText(copy.errors.billing.account_unknown)).toBeVisible();
});

test("the grant page is not found for an account without the admin role, and for a visitor", async ({ browser }) => {
  const visitor = await openPage(browser);
  expect((await visitor.goto("/admin/billing"))?.status()).toBe(404);
  const member = await openPage(browser);
  await register(member, newEmail());
  expect((await member.goto("/admin/billing"))?.status()).toBe(404);
});
