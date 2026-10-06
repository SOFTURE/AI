// @softure-ai/billing on the built app: a new account is on its 14-day trial and its write goes
// through; once its trial is over (moved into the past in Postgres) the badge and the notice say it
// is read-only, the notice links to the payment page, and the same write is refused and stores
// nothing. A paid period that ended is read-only the same way, with the renew notice. An account older than its trial gets its paid period back from the import-entitlements
// script, and pin-trials reports the trials it would pin. Every test gets its own client address
// and account.
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { billingMessages, entitlements } from "@softure-ai/billing";
import { clientAddressHeaders, uniqueEmail, uniqueName } from "@softure-ai/testing/playwright";
import { eq, inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { entries } from "../modules/guestbook/schema.ts";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DAY_MS = 24 * 60 * 60 * 1000;
const copy = billingMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];
const createdMessages: string[] = [];

function newMessage(): string {
  const message = uniqueName("e2e-billing");
  createdMessages.push(message);
  return message;
}

test.beforeEach(({ context }) =>
  context.setExtraHTTPHeaders(clientAddressHeaders()),
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

async function signInAndOpenBillingPage(page: Page): Promise<string> {
  const email = uniqueEmail("e2e-billing");
  createdEmails.push(email);
  await createSignedInAccount(page, { email, password: PASSWORD });
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

/** Stores the account's entitlement row as given, the way time would have left it. */
async function storeEntitlement(email: string, record: { trialEndsAt: Date; paidUntil: Date | null }): Promise<void> {
  const database = await openTestDatabase();
  try {
    const [account] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account === undefined) throw new Error(`storeEntitlement: no account for ${email}`);
    const now = new Date();
    await database.db
      .insert(entitlements)
      .values({ userId: account.id, ...record, isLifetime: false, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: entitlements.userId, set: { ...record, updatedAt: now } });
  } finally {
    await database.close();
  }
}

/** Ends the account's trial a minute ago. */
function endTrial(email: string): Promise<void> {
  return storeEntitlement(email, { trialEndsAt: new Date(Date.now() - 60_000), paidUntil: null });
}

/** Ends a paid period a minute ago, after a trial that ended a month before it. */
function endPaidPeriod(email: string): Promise<void> {
  const now = Date.now();
  return storeEntitlement(email, { trialEndsAt: new Date(now - 30 * DAY_MS), paidUntil: new Date(now - 60_000) });
}

test("the billing page is private: a visitor without a session goes to the login page", async ({ page }) => {
  await page.goto("/account/billing");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fbilling$/);
});

test("a new account is on its 14-day trial and may write", async ({ page }) => {
  await signInAndOpenBillingPage(page);
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
  const email = await signInAndOpenBillingPage(page);
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

test("an account whose paid period ended is asked to renew and cannot write", async ({ page }) => {
  const email = await signInAndOpenBillingPage(page);
  await endPaidPeriod(email);
  await page.reload();

  await expect(page.locator("[data-status]").first()).toHaveText(copy.badge.readOnly);
  await expect(page.getByRole("status").filter({ hasText: copy.notice.paidEnded })).toBeVisible();
  await expect(page.getByRole("link", { name: copy.notice.renew })).toHaveAttribute("href", "/payment");

  const message = newMessage();
  await signAsMember(page, message);
  await expect(page.getByText(en.errors["billing.read_only"])).toBeVisible();
  expect(await countEntries(message)).toBe(0);
});

/** Moves the account's creation back by `days`, as if it had signed up before billing was enabled. */
async function ageAccount(email: string, days: number): Promise<void> {
  const database = await openTestDatabase();
  try {
    const createdAt = new Date(Date.now() - days * DAY_MS);
    await database.db.update(users).set({ createdAt }).where(eq(users.email, email));
  } finally {
    await database.close();
  }
}

/** Runs a billing script of the example app. */
function runBillingScript(script: "import-entitlements" | "pin-trials", args: readonly string[]): { status: number | null; output: string } {
  const result = spawnSync("npm", ["run", "--silent", script, "--", ...args], { cwd: APP_DIR, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("an account older than its trial is read-only until import-entitlements gives back its paid period", async ({ page }) => {
  const email = await signInAndOpenBillingPage(page);
  await ageAccount(email, 60);
  await page.reload();
  await expect(page.locator("[data-status]").first()).toHaveText(copy.badge.readOnly);

  const folder = await mkdtemp(join(tmpdir(), "e2e-import-"));
  try {
    const file = join(folder, "entitlements.json");
    const paidUntil = new Date(Date.now() + 40 * DAY_MS).toISOString();
    await writeFile(file, JSON.stringify([{ email, paidUntil }]));
    const dryRun = runBillingScript("import-entitlements", [`--file=${file}`]);
    expect(dryRun.status, dryRun.output).toBe(0);
    expect(dryRun.output).toContain('after:  {"accounts":1,"trial":0,"paid":1,"lifetime":0,"readOnly":0}');
    await page.reload();
    await expect(page.locator("[data-status]").first()).toHaveText(copy.badge.readOnly);

    const imported = runBillingScript("import-entitlements", [`--file=${file}`, "--commit"]);
    expect(imported.status, imported.output).toBe(0);
    expect(imported.output).toContain("COMMITTED");
    expect(imported.output).not.toContain(email);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }

  await page.reload();
  await expect(page.locator("[data-status]").first()).toHaveAttribute("data-status", "paid");
  const message = newMessage();
  await signAsMember(page, message);
  await expect(page.getByText(en.billing.saved)).toBeVisible();
  expect(await countEntries(message)).toBe(1);
});

test("pin-trials reports the derived trials it would pin, and a dry run writes none", async ({ page }) => {
  const email = await signInAndOpenBillingPage(page);
  const pinned = runBillingScript("pin-trials", []);
  expect(pinned.status, pinned.output).toBe(0);
  expect(pinned.output).toMatch(/^after:\s+\{"accountsWithoutRow":0,"pinned":\d+\}$/m);
  expect(pinned.output).toContain("DRY RUN");
  const database = await openTestDatabase();
  try {
    const [account] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account === undefined) throw new Error(`pin-trials: no account for ${email}`);
    expect(await database.db.select().from(entitlements).where(eq(entitlements.userId, account.id))).toEqual([]);
  } finally {
    await database.close();
  }
});
