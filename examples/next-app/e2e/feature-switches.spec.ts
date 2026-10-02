// Feature switches of @softure-ai/feature-switches on the built app: the panel at /switches is not
// found for anonymous visitors and for users without the admin role; an admin flips the welcome
// banner switch there, the home page follows on the next request, and the row records who did it.
// The panel's action refuses a session that lost the role and stores nothing. Serial: the tests
// share the one switch row.
import { spawnSync } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { featureSwitchesMessages, switches } from "@softure-ai/feature-switches";
import { eq, inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { WELCOME_BANNER_SWITCH } from "../softure.config.ts";
import { openTestDatabase } from "./database.ts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const authCopy = authMessages.en;
const switchesCopy = featureSwitchesMessages.en;
const PASSWORD = "correct horse battery";
const BANNER_LABEL = en.switches.welcomeBanner.label;
const createdEmails: string[] = [];

test.describe.configure({ mode: "serial" });

/** A fresh address per context (198.18.0.0/15), so the register bucket never fills up. */
function randomAddress(): string {
  return `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

function newEmail(): string {
  const email = `e2e-switches-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

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

/** Registers an account and grants it admin with the example's grant-role script. */
async function registerAdmin(page: Page): Promise<string> {
  const email = newEmail();
  await register(page, email);
  const result = spawnSync("npm", ["run", "--silent", "grant-role", "--", `--email=${email}`, "--role=admin", "--commit"], {
    cwd: APP_DIR,
    encoding: "utf8",
  });
  expect(`${result.stdout}${result.stderr}`).toContain("COMMITTED");
  expect(result.status).toBe(0);
  return email;
}

interface StoredRow {
  readonly enabled: boolean;
  readonly updatedBy: string | null;
}

async function readBannerRow(): Promise<StoredRow | null> {
  const database = await openTestDatabase();
  try {
    const rows = await database.db
      .select({ enabled: switches.enabled, updatedBy: switches.updatedBy })
      .from(switches)
      .where(eq(switches.name, WELCOME_BANNER_SWITCH));
    return rows[0] ?? null;
  } finally {
    await database.close();
  }
}

async function findUserId(email: string): Promise<string | undefined> {
  const database = await openTestDatabase();
  try {
    return (await database.db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0]?.id;
  } finally {
    await database.close();
  }
}

/** Flips the banner switch and waits for the action's answer, so a stale state cannot pass. */
async function flipAndWait(page: Page): Promise<void> {
  const answered = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/switches"));
  await page.getByRole("switch", { name: BANNER_LABEL }).click();
  await answered;
}

async function resetBanner(): Promise<void> {
  const database = await openTestDatabase();
  try {
    await database.db.delete(switches).where(eq(switches.name, WELCOME_BANNER_SWITCH));
  } finally {
    await database.close();
  }
}

test.beforeAll(resetBanner);

test.afterAll(async () => {
  await resetBanner();
  const database = await openTestDatabase();
  try {
    if (createdEmails.length > 0) await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

test("an anonymous visitor and a user without the admin role get not found on the panel", async ({ browser }) => {
  const page = await openPage(browser);
  expect((await page.goto("/switches"))?.status()).toBe(404);
  await register(page, newEmail());
  expect((await page.goto("/switches"))?.status()).toBe(404);
});

test("an admin turns the welcome banner on and off, the home page follows and the row records who", async ({ browser }) => {
  const page = await openPage(browser);
  const email = await registerAdmin(page);
  await page.goto("/");
  await expect(page.getByTestId("welcome-banner")).toHaveCount(0);

  await page.goto("/switches");
  await expect(page.getByText(switchesCopy.panel.title, { exact: true })).toBeVisible();
  const toggle = page.getByRole("switch", { name: BANNER_LABEL });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText(switchesCopy.source.default)).toBeVisible();

  await flipAndWait(page);
  await expect(toggle).toBeChecked();
  expect(await readBannerRow()).toEqual({ enabled: true, updatedBy: await findUserId(email) });
  await page.goto("/");
  await expect(page.getByTestId("welcome-banner")).toHaveText(en.home.welcomeBanner);

  await page.goto("/switches");
  await expect(page.getByRole("switch", { name: BANNER_LABEL })).toBeChecked();
  await flipAndWait(page);
  await expect(page.getByRole("switch", { name: BANNER_LABEL })).not.toBeChecked();
  expect((await readBannerRow())?.enabled).toBe(false);
  await page.goto("/");
  await expect(page.getByTestId("welcome-banner")).toHaveCount(0);
});

test("the panel's action refuses a session without the admin role and an anonymous one, and stores nothing", async ({ browser }) => {
  await resetBanner();
  const page = await openPage(browser);
  await registerAdmin(page);
  await page.goto("/switches");

  // The panel stays open in this tab while the browser's session becomes a non-admin's.
  const other = await page.context().newPage();
  await page.context().clearCookies();
  await register(other, newEmail());
  await flipAndWait(page);
  await expect(page.getByText(switchesCopy.errors.auth.forbidden)).toBeVisible();
  await expect(page.getByRole("switch", { name: BANNER_LABEL })).not.toBeChecked();

  await page.context().clearCookies();
  await flipAndWait(page);
  await expect(page.getByText(switchesCopy.errors.auth.forbidden)).toBeVisible();
  expect(await readBannerRow()).toBeNull();
});
