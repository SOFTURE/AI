// auth.registration_closed flipped in the switches panel of @softure-ai/feature-switches: auth reads
// it through core's switch reader, so the register page, the register action and the login page's
// register link follow the stored value on the next request. A serial spec (playwright.config.ts):
// it closes registration for the whole app, so it runs after every parallel spec has finished.
import { expect, test, type Page } from "@playwright/test";
import { authMessages, REGISTRATION_CLOSED_SWITCH, users } from "@softure-ai/auth";
import { switches } from "@softure-ai/feature-switches";
import { openPageAsNewClient, uniqueEmail } from "@softure-ai/testing/playwright";
import { eq, inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";

const authCopy = authMessages.en;
const PASSWORD = "correct horse battery";
const SWITCH_LABEL = en.switches.registrationClosed.label;
const createdEmails: string[] = [];

test.describe.configure({ mode: "serial" });

function newEmail(): string {
  const email = uniqueEmail("e2e-registration-switch");
  createdEmails.push(email);
  return email;
}

async function fillRegisterForm(page: Page, email: string): Promise<void> {
  await page.getByLabel(authCopy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(authCopy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(authCopy.fields.consent).check();
}

async function register(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await fillRegisterForm(page, email);
  await page.getByRole("button", { name: authCopy.register.submit }).click();
  await expect(page).toHaveURL("/account");
}

async function readStoredValue(): Promise<boolean | null> {
  const database = await openTestDatabase();
  try {
    const rows = await database.db.select({ enabled: switches.enabled }).from(switches).where(eq(switches.name, REGISTRATION_CLOSED_SWITCH));
    return rows[0]?.enabled ?? null;
  } finally {
    await database.close();
  }
}

/** Flips the registration switch and waits for the action's answer, so a stale state cannot pass. */
async function flipAndWait(page: Page): Promise<void> {
  const answered = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/switches"));
  await page.getByRole("switch", { name: SWITCH_LABEL }).click();
  await answered;
}

async function resetSwitch(): Promise<void> {
  const database = await openTestDatabase();
  try {
    await database.db.delete(switches).where(eq(switches.name, REGISTRATION_CLOSED_SWITCH));
  } finally {
    await database.close();
  }
}

test.beforeAll(resetSwitch);

test.afterAll(async () => {
  // Reopens registration even when a test failed half-way.
  await resetSwitch();
  const database = await openTestDatabase();
  try {
    if (createdEmails.length > 0) await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

test("an admin closes registration in the panel, auth refuses new accounts, and reopening lets them in", async ({ browser }) => {
  const admin = await openPageAsNewClient(browser);
  await createSignedInAccount(admin, { email: newEmail(), password: PASSWORD, roles: ["admin"] });
  await admin.goto("/switches");
  const toggle = admin.getByRole("switch", { name: SWITCH_LABEL });
  await expect(toggle).not.toBeChecked();

  // A visitor has the register form open while the admin closes registration.
  const visitor = await openPageAsNewClient(browser);
  await visitor.goto("/register");
  await fillRegisterForm(visitor, newEmail());

  await flipAndWait(admin);
  await expect(toggle).toBeChecked();
  expect(await readStoredValue()).toBe(true);

  await visitor.getByRole("button", { name: authCopy.register.submit }).click();
  await expect(visitor.getByText(authCopy.errors.auth.registration_closed)).toBeVisible();
  await expect(visitor).toHaveURL("/register");

  const closed = await openPageAsNewClient(browser);
  await closed.goto("/register");
  await expect(closed.getByText(authCopy.register.closedTitle)).toBeVisible();
  await expect(closed.getByRole("button", { name: authCopy.register.submit })).toHaveCount(0);
  await closed.goto("/login");
  await expect(closed.getByRole("button", { name: authCopy.login.submit })).toBeVisible();
  await expect(closed.getByRole("link", { name: authCopy.login.registerLink })).toHaveCount(0);

  await admin.goto("/switches");
  await flipAndWait(admin);
  await expect(admin.getByRole("switch", { name: SWITCH_LABEL })).not.toBeChecked();
  expect(await readStoredValue()).toBe(false);

  const reopened = await openPageAsNewClient(browser);
  await reopened.goto("/login");
  await expect(reopened.getByRole("link", { name: authCopy.login.registerLink })).toBeVisible();
  await register(reopened, newEmail());
});
