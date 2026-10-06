// @softure-ai/privacy on the built app: the export download and the self-service account deletion,
// with the account read back from Postgres. Every test gets its own client address (the example
// resolves clients from CF-Connecting-IP) and its own account.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { privacyMessages } from "@softure-ai/privacy";
import { clientAddressHeaders, uniqueEmail } from "@softure-ai/testing/playwright";
import { eq, inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";

const authCopy = authMessages.en;
const copy = privacyMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];

function newEmail(): string {
  const email = uniqueEmail("e2e-privacy");
  createdEmails.push(email);
  return email;
}

test.beforeEach(({ context }) => context.setExtraHTTPHeaders(clientAddressHeaders()));

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

async function signInAndOpenPrivacyPage(page: Page, email: string): Promise<void> {
  await createSignedInAccount(page, { email, password: PASSWORD });
  await page.getByRole("link", { name: en.account.privacy }).click();
  await expect(page).toHaveURL("/account/privacy");
}

async function countAccounts(email: string): Promise<number> {
  const database = await openTestDatabase();
  try {
    return (await database.db.select({ id: users.id }).from(users).where(eq(users.email, email))).length;
  } finally {
    await database.close();
  }
}

test("the privacy page is private: a visitor without a session goes to the login page", async ({ page }) => {
  await page.goto("/account/privacy");
  await expect(page).toHaveURL("/login?next=%2Faccount%2Fprivacy");
});

test("the export route refuses a request without a session", async ({ request }) => {
  const response = await request.get("/api/privacy/export");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ error: "auth.unauthenticated" });
});

test("a signed-in user downloads every module's part of their data as a JSON file", async ({ page }) => {
  const email = newEmail();
  await signInAndOpenPrivacyPage(page, email);

  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: copy.export.button }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^account-data-\d{4}-\d{2}-\d{2}\.json$/);

  const path = await download.path();
  const text = await readFile(path, "utf8");
  const document = JSON.parse(text) as { format: string; data: Record<string, { account?: { email: string } }> };
  expect(document.format).toBe("softure.privacy-export");
  expect(Object.keys(document.data)).toEqual(["auth", "feature-switches", "mcp-access", "privacy", "waitlist", "billing"]);
  expect(document.data["auth"]?.account?.email).toBe(email);
  expect(text).not.toContain("scrypt$");

  const response = await page.request.get("/api/privacy/export");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["content-disposition"]).toMatch(/^attachment; filename="account-data-\d{4}-\d{2}-\d{2}\.json"$/);
});

test("deleting the account needs the current password, then removes it and signs the user out", async ({ page }) => {
  const email = newEmail();
  await signInAndOpenPrivacyPage(page, email);
  const form = page.locator("form");

  await page.getByLabel(copy.delete.password).fill("not my password");
  await page.getByLabel(copy.delete.confirm).check();
  await page.getByRole("button", { name: copy.delete.submit }).click();
  await expect(page.getByText(copy.errors.privacy.password_invalid)).toBeVisible();
  expect(await countAccounts(email)).toBe(1);

  await page.getByLabel(copy.delete.password).fill(PASSWORD);
  await page.getByLabel(copy.delete.confirm).check();
  await form.getByRole("button", { name: copy.delete.submit }).click();
  await expect(page).toHaveURL("/");
  expect(await countAccounts(email)).toBe(0);

  const cookies = await page.context().cookies();
  expect(cookies.filter((cookie) => cookie.name.includes("softure_session") && cookie.value !== "")).toEqual([]);
  await page.goto("/account");
  await expect(page).toHaveURL("/login?next=%2Faccount");

  await page.getByLabel(authCopy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(authCopy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: authCopy.login.submit }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(authCopy.errors.auth.invalid_credentials);
});
