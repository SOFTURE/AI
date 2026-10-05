// Roles of @softure-ai/auth on the built app: the admin page, the admin route handler and the admin
// action are closed to anonymous visitors and to users without the admin role, open to the admin
// of `adminEmails` and to an account granted admin with the grant-role script. Serial: the
// configured admin is one account, registered once for the file.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { expectPageStatus, logIn, openPageAsNewClient, registerAccount, uniqueEmail } from "@softure-ai/testing/playwright";
import { eq, inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { entries } from "../modules/guestbook/schema.ts";
import { EXAMPLE_ADMIN_EMAIL } from "../softure.config.ts";
import { deleteEntries, openTestDatabase } from "./database.ts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const authCopy = authMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [EXAMPLE_ADMIN_EMAIL];
const postedMessages: string[] = [];

test.describe.configure({ mode: "serial" });

function newEmail(): string {
  const email = uniqueEmail("e2e-roles");
  createdEmails.push(email);
  return email;
}

async function deleteAccounts(emails: string[]): Promise<void> {
  const database = await openTestDatabase();
  try {
    await database.db.delete(users).where(inArray(users.email, emails));
  } finally {
    await database.close();
  }
}

async function countEntries(message: string): Promise<number> {
  const database = await openTestDatabase();
  try {
    return (await database.db.select({ id: entries.id }).from(entries).where(eq(entries.message, message))).length;
  } finally {
    await database.close();
  }
}

async function register(page: Page, email: string): Promise<void> {
  await registerAccount(page, { copy: authCopy, email, password: PASSWORD });
}

async function expectClosed(page: Page): Promise<void> {
  await expectPageStatus(page, "/admin", 404);
  expect((await page.request.get("/api/admin/status")).status()).toBe(404);
}

/** Submits the announcement and waits for the action's answer, so a stale message cannot pass. */
async function submitAndWait(page: Page): Promise<void> {
  const answered = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/admin"));
  await page.getByRole("button", { name: en.admin.submit }).click();
  await answered;
}

function runRoleScript(script: "grant-role" | "revoke-role", email: string): { status: number | null; output: string } {
  const result = spawnSync("npm", ["run", "--silent", script, "--", `--email=${email}`, "--role=admin", "--commit"], {
    cwd: APP_DIR,
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test.beforeAll(async ({ browser }) => {
  // A run that died before its cleanup must not leave the admin account behind.
  await deleteAccounts([EXAMPLE_ADMIN_EMAIL]);
  const page = await openPageAsNewClient(browser);
  await register(page, EXAMPLE_ADMIN_EMAIL);
  await page.context().close();
});

test.afterAll(async () => {
  await deleteAccounts(createdEmails);
  const database = await openTestDatabase();
  try {
    for (const message of postedMessages) await deleteEntries(database, message);
  } finally {
    await database.close();
  }
});

test("an anonymous visitor gets not found on the admin page and the admin route", async ({ browser }) => {
  const page = await openPageAsNewClient(browser);
  await expectClosed(page);
});

test("a signed-in user without the admin role gets not found and sees no admin link", async ({ browser }) => {
  const page = await openPageAsNewClient(browser);
  await register(page, newEmail());
  await expect(page.getByRole("link", { name: en.account.admin })).toHaveCount(0);
  await expectClosed(page);
});

test("the admin of adminEmails opens the panel from the account page and posts through the admin action", async ({ browser }) => {
  const page = await openPageAsNewClient(browser);
  await logIn(page, { copy: authCopy, email: EXAMPLE_ADMIN_EMAIL, password: PASSWORD });
  await page.getByRole("link", { name: en.account.admin }).click();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByText(en.admin.title, { exact: true })).toBeVisible();
  expect((await page.request.get("/api/admin/status")).status()).toBe(200);

  const message = `e2e announcement ${randomUUID()}`;
  postedMessages.push(message);
  await page.getByRole("textbox", { name: en.admin.messageLabel }).fill(message);
  await page.getByRole("button", { name: en.admin.submit }).click();
  await expect(page.getByRole("status")).toHaveText(en.admin.saved);
  expect(await countEntries(message)).toBe(1);
});

test("the admin action refuses a user without the role and an anonymous visitor, and writes nothing", async ({ browser }) => {
  const page = await openPageAsNewClient(browser);
  await logIn(page, { copy: authCopy, email: EXAMPLE_ADMIN_EMAIL, password: PASSWORD });
  await page.goto("/admin");
  const field = page.getByRole("textbox", { name: en.admin.messageLabel });
  const message = `e2e refused ${randomUUID()}`;
  postedMessages.push(message);

  // The panel stays open in this tab while the browser's session becomes a non-admin's.
  const other = await page.context().newPage();
  await page.context().clearCookies();
  await register(other, newEmail());
  await field.fill(message);
  await submitAndWait(page);
  await expect(page.getByText(en.errors["auth.forbidden"])).toBeVisible();

  await page.context().clearCookies();
  await submitAndWait(page);
  await expect(page.getByText(en.errors["auth.forbidden"])).toBeVisible();
  expect(await countEntries(message)).toBe(0);
});

test("an account granted admin with the grant-role script gets in, and loses it on revoke-role", async ({ browser }) => {
  const page = await openPageAsNewClient(browser);
  const email = newEmail();
  await register(page, email);
  await expectClosed(page);

  const granted = runRoleScript("grant-role", email);
  expect(granted.output).toContain("COMMITTED");
  expect(granted.status).toBe(0);
  await expectPageStatus(page, "/admin", 200);

  const revoked = runRoleScript("revoke-role", email);
  expect(revoked.output).toContain("COMMITTED");
  expect(revoked.status).toBe(0);
  await expectClosed(page);
});
