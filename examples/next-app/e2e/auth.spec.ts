// @softure-ai/auth on the built app: the pages, actions, route handler and proxy guard shipped by
// the package, with sessions and rate limits read back from Postgres. Every test gets its own
// client address (the example resolves clients from CF-Connecting-IP) and its own account.
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { inArray } from "drizzle-orm";
import { openTestDatabase } from "./database.ts";

const copy = authMessages.en;
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new passphrase";
const createdEmails: string[] = [];

/** A fresh address per test (198.18.0.0/15, reserved for benchmarks), so buckets never leak between tests. */
function randomAddress(): string {
  return `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

function newEmail(): string {
  const email = `e2e-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

test.use({ extraHTTPHeaders: { "cf-connecting-ip": randomAddress() } });
test.beforeEach(({ context }) => context.setExtraHTTPHeaders({ "cf-connecting-ip": randomAddress() }));

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

async function register(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(password);
  await page.getByLabel(copy.fields.consent).check();
  await page.getByRole("button", { name: copy.register.submit }).click();
  await expect(page).toHaveURL("/account");
}

/** Submits the login form and waits for the action's answer, so the next fill is not reset by it. */
async function logIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(password);
  const answered = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: copy.login.submit }).click();
  await answered;
}

async function openSignedInPage(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": randomAddress() } });
  const page = await context.newPage();
  await page.goto("/login");
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL("/account");
  return page;
}

test("the guard sends a visitor without a session from /account to the login page and back after login", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.context().clearCookies();

  await page.goto("/account");
  await expect(page).toHaveURL("/login?next=%2Faccount");
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL("/account");
  await expect(page.getByTestId("account-email")).toHaveText(email);
});

test("register signs the new user in with an HttpOnly, SameSite=Lax session cookie", async ({ page }) => {
  const email = newEmail();
  await register(page, email.toUpperCase());
  await expect(page.getByTestId("account-email")).toHaveText(email);

  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === "softure_session");
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/", secure: false });
  expect(session?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);

  const response = await page.request.get("/api/auth/session");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = (await response.json()) as { user: { id: string; email: string } | null };
  expect(body.user?.email).toBe(email);
  expect(body.user?.id).toMatch(/^[0-9a-f-]{36}$/);
});

test("a taken email is refused at the email field and keeps what was typed", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.context().clearCookies();

  await page.goto("/register");
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(copy.fields.consent).check();
  await page.getByRole("button", { name: copy.register.submit }).click();
  await expect(page.getByText(copy.errors.auth.email_taken)).toBeVisible();
  await expect(page.getByLabel(copy.fields.email, { exact: true })).toHaveValue(email);
});

test("logout ends the session and the account page is guarded again", async ({ page }) => {
  await register(page, newEmail());
  await page.getByRole("button", { name: copy.logout.submit }).click();
  await expect(page).toHaveURL("/login");
  expect(await (await page.request.get("/api/auth/session")).json()).toEqual({ user: null });
  await page.goto("/account");
  await expect(page).toHaveURL("/login?next=%2Faccount");
});

test("a wrong password is refused with one message for every cause", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.context().clearCookies();

  await page.goto("/login");
  await logIn(page, email, "wrong horse battery");
  await expect(page.locator("form").getByRole("alert")).toHaveText(copy.errors.auth.invalid_credentials);
  await logIn(page, newEmail(), PASSWORD);
  await expect(page.locator("form").getByRole("alert")).toHaveText(copy.errors.auth.invalid_credentials);
});

test("a next parameter pointing to another origin falls back to afterLogin", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.context().clearCookies();

  await page.goto("/login?next=https%3A%2F%2Fevil.example%2F");
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL("/account");
});

test("the login-account limit stops guessing on one account", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.context().clearCookies();

  await page.goto("/login");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await logIn(page, email, `wrong password ${String(attempt)}`);
    await expect(page.locator("form").getByRole("alert")).toHaveText(copy.errors.auth.invalid_credentials);
  }
  await logIn(page, email, PASSWORD);
  await expect(page.locator("form").getByRole("alert")).toHaveText(copy.errors.security.rate_limited);
});

test("changing the password keeps this session and ends the others", async ({ page, browser }) => {
  const email = newEmail();
  await register(page, email);
  const other = await openSignedInPage(browser, email);

  await page.goto("/account/password");
  await page.getByLabel(copy.fields.currentPassword, { exact: true }).fill("not my password");
  await page.getByLabel(copy.fields.newPassword, { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: copy.changePassword.submit }).click();
  await expect(page.getByText(copy.errors.auth.current_password_invalid)).toBeVisible();

  await page.getByLabel(copy.fields.currentPassword, { exact: true }).fill(PASSWORD);
  await page.getByLabel(copy.fields.newPassword, { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: copy.changePassword.submit }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText(copy.changePassword.success);

  await page.goto("/account");
  await expect(page.getByTestId("account-email")).toHaveText(email);
  // The other browser still holds its cookie, but its session row is gone.
  await other.goto("/account");
  await expect(other).toHaveURL("/login?next=%2Faccount");
  await logIn(other, email, PASSWORD);
  await expect(other.locator("form").getByRole("alert")).toHaveText(copy.errors.auth.invalid_credentials);
  await logIn(other, email, NEW_PASSWORD);
  await expect(other).toHaveURL("/account");
  await other.context().close();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("register, logout and login work as plain HTML forms", async ({ page }) => {
    const email = newEmail();
    await register(page, email);
    await page.getByRole("button", { name: copy.logout.submit }).click();
    await expect(page).toHaveURL("/login");
    await logIn(page, email, PASSWORD);
    await expect(page).toHaveURL("/account");
    await expect(page.getByTestId("account-email")).toHaveText(email);
  });
});
