// Plans, the payment page and the manual adapter of @softure-ai/billing on the built app: the
// public pricing page lists the plans of softure.config.ts, choosing one asks a visitor to log in
// and comes back to it, an invoice request mails the admin and grants nothing, and the admin's
// grant at /admin/billing flips the account's trial to paid. The admin page lists open requests
// (grant or dismiss each), finds an account's history and revokes a manual grant; a lifetime
// account has nothing to pay. The grant-plan and revoke-grant scripts write the same history the
// admin page shows. Asking again does not mail the admin twice, a field the server refuses says
// why, and the expire-invoice-requests script closes a request nobody asked again for. Every test
// gets its own client address and accounts; the admin is an account given the role in Postgres
// (auth-roles.spec.ts owns the configured admin). Other tests' requests share the list, so rows
// are always picked by the member's address.
import { spawnSync } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { authMessages, userRoles, users } from "@softure-ai/auth";
import { billingMessages } from "@softure-ai/billing";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { eq, inArray, sql } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { EXAMPLE_ADMIN_EMAIL } from "../softure.config.ts";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX } from "./outbox.ts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

test("a too-long tax id gets its own message, and nothing is stored or mailed", async ({ browser }) => {
  const page = await openPage(browser);
  const email = newEmail();
  await register(page, email);
  await page.goto("/payment?plan=monthly");
  const taxId = page.getByLabel(copy.payment.fields.taxId);
  // The field's maxLength stops a browser; a crafted request does not, and the server says why.
  await taxId.evaluate((input) => input.removeAttribute("maxlength"));
  await page.getByLabel(copy.payment.fields.name).fill("Ada Lovelace Ltd");
  await taxId.fill("P".repeat(33));
  await page.getByLabel(copy.payment.fields.address).fill("1 Analytical Way, London");
  await page.getByRole("button", { name: copy.payment.requestInvoice }).click();
  await expect(page.getByText("Use at most 32 characters.")).toBeVisible();
  await expect(taxId).toHaveAttribute("aria-invalid", "true");

  const mails = (await readMailOutbox(MAIL_OUTBOX, { to: EXAMPLE_ADMIN_EMAIL })).filter((mail) => mail.subject.endsWith(` for ${email}`));
  expect(mails).toHaveLength(0);
});

test("asking again for the same plan refreshes the request without mailing the admin again", async ({ browser }) => {
  const member = await openPage(browser);
  const email = newEmail();
  await register(member, email);
  await requestInvoice(member, en.plans.monthly.name);
  await requestInvoice(member, en.plans.monthly.name, "2 Difference Lane, London");

  const mails = (await readMailOutbox(MAIL_OUTBOX, { to: EXAMPLE_ADMIN_EMAIL })).filter((mail) => mail.subject === `Invoice request: ${en.plans.monthly.name} for ${email}`);
  expect(mails).toHaveLength(1);
  const admin = await openPage(browser);
  await registerAdmin(admin);
  await admin.goto("/admin/billing");
  const request = admin.locator("[data-request-id]").filter({ hasText: email });
  await expect(request).toHaveCount(1);
  await expect(request).toContainText("Invoice to: Ada Lovelace Ltd, 2 Difference Lane, London");
  expect(plain(await request.textContent())).toContain("Price: PLN 29.00");
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
  // Plain text, not a pattern: the address is compared as typed.
  await expect(admin.getByRole("status").filter({ hasText: email })).toContainText(`${email} now has ${en.plans.monthly.name}, with access until `);

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

/** Asks for an invoice for `planName` from the payment page. */
async function requestInvoice(page: Page, planName: string, address = "1 Analytical Way, London"): Promise<void> {
  await page.goto("/payment");
  await page.getByRole("link", { name: `Choose ${planName}` }).click();
  await page.getByLabel(copy.payment.fields.name).fill("Ada Lovelace Ltd");
  await page.getByLabel(copy.payment.fields.address).fill(address);
  await page.getByRole("button", { name: copy.payment.requestInvoice }).click();
  await expect(page.getByRole("status").filter({ hasText: "Thank you!" })).toBeVisible();
}

async function readBadgeStatus(page: Page): Promise<string | null> {
  await page.goto("/account/billing");
  return page.locator("[data-status]").first().getAttribute("data-status");
}

test("an invoice request waits in the admin's list; Grant gives the plan and Revoke takes it back", async ({ browser }) => {
  const member = await openPage(browser);
  const email = newEmail();
  await register(member, email);
  await requestInvoice(member, en.plans.yearly.name);

  const admin = await openPage(browser);
  await registerAdmin(admin);
  await admin.goto("/admin/billing");
  const request = admin.locator("[data-request-id]").filter({ hasText: email });
  await expect(request).toContainText(`${email} · ${en.plans.yearly.name}`);
  await expect(request).toContainText("Invoice to: Ada Lovelace Ltd, 1 Analytical Way, London");
  await admin.getByRole("button", { name: `Grant ${en.plans.yearly.name} to ${email}` }).click();
  await expect(request).toHaveCount(0);
  expect(await readBadgeStatus(member)).toBe("paid");

  // The history is found by email but addressed by the account's id.
  await admin.getByLabel(copy.admin.history.email).fill(email);
  await admin.getByRole("button", { name: copy.admin.history.submit }).click();
  await expect(admin).toHaveURL(/\/admin\/billing\?account=[0-9a-f-]{36}$/);
  const history = admin.getByRole("region", { name: `History of ${email}` });
  await expect(history.locator("[data-status]")).toHaveAttribute("data-status", "paid");
  const grant = history.locator("[data-history-id]");
  await expect(grant).toHaveCount(1);
  await expect(grant).toContainText(`${en.plans.yearly.name}, granted from a request`);
  expect(plain(await grant.textContent())).toContain("Granted for PLN 290.00 on ");
  await expect(grant).toContainText(copy.admin.history.active);
  await grant.getByRole("button", { name: new RegExp(`^Revoke ${en.plans.yearly.name} granted on `) }).click();
  await expect(grant).toContainText("Revoked on ");
  await expect(grant.getByRole("button")).toHaveCount(0);
  expect(await readBadgeStatus(member)).toBe("trial");
});

test("Dismiss closes a request without a grant, and its History link shows the account", async ({ browser }) => {
  const member = await openPage(browser);
  const email = newEmail();
  await register(member, email);
  await requestInvoice(member, en.plans.monthly.name);

  const admin = await openPage(browser);
  await registerAdmin(admin);
  await admin.goto("/admin/billing");
  const request = admin.locator("[data-request-id]").filter({ hasText: email });
  await request.getByRole("link", { name: copy.admin.requests.history }).click();
  await expect(admin).toHaveURL(/\/admin\/billing\?account=[0-9a-f-]{36}$/);
  await expect(admin.getByRole("region", { name: `History of ${email}` })).toContainText(copy.admin.history.empty);

  await admin.getByRole("button", { name: `Dismiss the request of ${email} for ${en.plans.monthly.name}` }).click();
  await expect(request).toHaveCount(0);
  expect(await readBadgeStatus(member)).toBe("trial");
});

test("a lifetime account has nothing to pay, and the admin cannot grant it again", async ({ browser }) => {
  const member = await openPage(browser);
  const email = newEmail();
  await register(member, email);

  const admin = await openPage(browser);
  await registerAdmin(admin);
  await admin.goto("/admin/billing");
  const grant = async () => {
    await admin.getByLabel(copy.admin.email).fill(email);
    await admin.getByRole("combobox", { name: copy.admin.plan }).click();
    await admin.getByRole("option", { name: en.plans.lifetime.name }).click();
    await admin.getByRole("button", { name: copy.admin.submit }).click();
  };
  await grant();
  await expect(admin.getByRole("status").filter({ hasText: email })).toContainText(`${email} now has ${en.plans.lifetime.name}.`);
  await grant();
  await expect(admin.getByText(copy.errors.billing.lifetime_active)).toBeVisible();

  await member.goto("/payment?plan=monthly");
  await expect(member.getByText(copy.payment.lifetime)).toBeVisible();
  await expect(member.getByText(copy.payment.orderTitle)).toHaveCount(0);
});

/** Runs a billing script of the example app with `--commit`. */
function runPlanScript(script: "grant-plan" | "revoke-grant", args: readonly string[]): { status: number | null; output: string } {
  const result = spawnSync("npm", ["run", "--silent", script, "--", ...args, "--commit"], { cwd: APP_DIR, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("a plan granted with the grant-plan script is in the admin's history, and revoke-grant takes it back", async ({ browser }) => {
  const member = await openPage(browser);
  const email = newEmail();
  await register(member, email);

  const granted = runPlanScript("grant-plan", [`--email=${email}`, "--plan=monthly"]);
  expect(granted.status, granted.output).toBe(0);
  expect(granted.output).toContain("COMMITTED");
  expect(granted.output).not.toContain(email);
  expect(await readBadgeStatus(member)).toBe("paid");

  const admin = await openPage(browser);
  await registerAdmin(admin);
  await admin.goto("/admin/billing");
  await admin.getByLabel(copy.admin.history.email).fill(email);
  await admin.getByRole("button", { name: copy.admin.history.submit }).click();
  const grant = admin.getByRole("region", { name: `History of ${email}` }).locator("[data-history-id]");
  await expect(grant).toHaveCount(1);
  await expect(grant).toContainText(`${en.plans.monthly.name}, granted by hand`);
  const grantId = await grant.getAttribute("data-history-id");
  expect(grantId).toMatch(/^[0-9a-f-]{36}$/);

  const revoked = runPlanScript("revoke-grant", [`--email=${email}`, `--grant=${grantId ?? ""}`]);
  expect(revoked.status, revoked.output).toBe(0);
  expect(revoked.output).toContain("COMMITTED");
  expect(await readBadgeStatus(member)).toBe("trial");
  await admin.reload();
  await expect(grant).toContainText("Revoked on ");
});

test("a request nobody asked again for expires through the expire-invoice-requests script", async ({ browser }) => {
  const member = await openPage(browser);
  const email = newEmail();
  await register(member, email);
  await requestInvoice(member, en.plans.monthly.name);

  const database = await openTestDatabase();
  try {
    // 31 days ago: older than the default 30-day age.
    await database.db.execute(
      sql`UPDATE billing.payment_requests AS request SET requested_at = now() - interval '31 days', handed_over_at = now() - interval '31 days' FROM auth.users AS account WHERE account.id = request.user_id AND account.email = ${email}`,
    );
    const result = spawnSync("npm", ["run", "--silent", "expire-invoice-requests"], { cwd: APP_DIR, encoding: "utf8" });
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    expect((JSON.parse(result.stdout.trim()) as { expired: number }).expired).toBeGreaterThanOrEqual(1);
    const rows = await database.db.execute<{ status: string; invoice_name: string | null }>(
      sql`SELECT request.status, request.invoice_name FROM billing.payment_requests AS request JOIN auth.users AS account ON account.id = request.user_id WHERE account.email = ${email}`,
    );
    expect(rows.rows).toEqual([{ status: "expired", invoice_name: null }]);
  } finally {
    await database.close();
  }

  const admin = await openPage(browser);
  await registerAdmin(admin);
  await admin.goto("/admin/billing");
  await expect(admin.locator("[data-request-id]").filter({ hasText: email })).toHaveCount(0);
});
