// @softure-ai/billing on the built app: a new account is on its 14-day trial and its write goes
// through; once its trial is over (moved into the past in Postgres) the badge and the notice say it
// is read-only, the notice links to the payment page, and the same write is refused and stores
// nothing. Every test gets its own client address and account.
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { billingMessages, entitlements } from "@softure-ai/billing";
import { eq, inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { entries } from "../modules/guestbook/schema.ts";
import { openTestDatabase } from "./database.ts";

const authCopy = authMessages.en;
const copy = billingMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];
const createdMessages: string[] = [];

function newMessage(): string {
  const message = `e2e-billing-${randomUUID()}`;
  createdMessages.push(message);
  return message;
}

test.beforeEach(({ context }) =>
  context.setExtraHTTPHeaders({ "cf-connecting-ip": `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}` }),
);

test.afterAll(async () => {
  const database = await openTestDatabase();
  try {
    // Only this worker's own rows: tests in other workers may still be writing theirs.
    if (createdMessages.length > 0) await database.db.delete(entries).where(inArray(entries.message, createdMessages));
    // The entitlement rows go with the accounts (ON DELETE CASCADE).
    if (createdEmails.length > 0) await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

async function registerAndOpenBillingPage(page: Page): Promise<string> {
  const email = `e2e-billing-${randomUUID()}@example.com`;
  createdEmails.push(email);
  await page.goto("/register");
  await page.getByLabel(authCopy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(authCopy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(authCopy.fields.consent).check();
  await page.getByRole("button", { name: authCopy.register.submit }).click();
  await expect(page).toHaveURL("/account");
  await page.getByRole("link", { name: en.account.billing }).click();
  await expect(page).toHaveURL("/account/billing");
  return email;
}

async function signAsMember(page: Page, message: string): Promise<void> {
  await page.getByLabel(en.billing.messageLabel).fill(message);
  await page.getByRole("button", { name: en.billing.submit }).click();
}

async function countEntries(message: string): Promise<number> {
  const database = await openTestDatabase();
  try {
    return (await database.db.select({ id: entries.id }).from(entries).where(eq(entries.message, message))).length;
  } finally {
    await database.close();
  }
}

/** Ends the account's trial a minute ago, the way time would. */
async function endTrial(email: string): Promise<void> {
  const database = await openTestDatabase();
  try {
    const [account] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account === undefined) throw new Error(`endTrial: no account for ${email}`);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() - 60_000);
    await database.db
      .insert(entitlements)
      .values({ userId: account.id, trialEndsAt, paidUntil: null, isLifetime: false, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: entitlements.userId, set: { trialEndsAt, updatedAt: now } });
  } finally {
    await database.close();
  }
}

test("the billing page is private: a visitor without a session goes to the login page", async ({ page }) => {
  await page.goto("/account/billing");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fbilling$/);
});

test("a new account is on its 14-day trial and may write", async ({ page }) => {
  await registerAndOpenBillingPage(page);
  const badge = page.locator("[data-status]").first();
  // 14 on the registration day; 13 if the page renders after midnight in Warsaw.
  await expect(badge).toHaveText(new RegExp(`^${copy.badge.trial}1[34] days left$`));
  await expect(badge).toHaveAttribute("data-status", "trial");
  // Outside the reminder window there is nothing to tell.
  await expect(page.getByRole("link", { name: copy.notice.choosePlan })).toHaveCount(0);

  const message = newMessage();
  await signAsMember(page, message);
  await expect(page.getByText(en.billing.saved)).toBeVisible();
  expect(await countEntries(message)).toBe(1);
});

test("a read-only account sees why, is sent to the payment page, and cannot write", async ({ page }) => {
  const email = await registerAndOpenBillingPage(page);
  await endTrial(email);
  await page.reload();

  await expect(page.locator("[data-status]").first()).toHaveText(copy.badge.readOnly);
  await expect(page.getByRole("status").filter({ hasText: copy.notice.trialEnded })).toBeVisible();
  await expect(page.getByRole("link", { name: copy.notice.choosePlan })).toHaveAttribute("href", "/payment");

  const message = newMessage();
  await signAsMember(page, message);
  await expect(page.getByText(en.errors["billing.read_only"])).toBeVisible();
  expect(await countEntries(message)).toBe(0);
});
