// Password reset of @softure-ai/auth on the built app: the request page, the link the example's
// sender writes to the e2e outbox (e2e/outbox.ts), the reset page and the effects in Postgres.
// Every test gets its own client address and its own account.
import { expect, test, type Page } from "@playwright/test";
import { formatMessage } from "@softure-ai/core";
import { authMessages, users } from "@softure-ai/auth";
import { clientAddressHeaders, logIn, openPageAsNewClient, uniqueEmail, waitFor } from "@softure-ai/testing/playwright";
import { inArray } from "drizzle-orm";
import { createAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";
import { readResetLinks } from "./outbox.ts";

const copy = authMessages.en;
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new passphrase";
const SENT_NOTICE = formatMessage(copy.forgotPassword.sent, { ttlMinutes: 60 });
const createdEmails: string[] = [];

function newEmail(): string {
  const email = uniqueEmail("e2e-reset");
  createdEmails.push(email);
  return email;
}

test.beforeEach(({ context }) => context.setExtraHTTPHeaders(clientAddressHeaders()));

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    // Pending resets go with their accounts (ON DELETE CASCADE).
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

async function requestLink(page: Page, email: string): Promise<void> {
  await page.goto("/forgot-password");
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByRole("button", { name: copy.forgotPassword.submit }).click();
}

/** The newest link sent to `email`, once the sender (which runs after the response) wrote it. */
async function waitForLink(email: string, count = 1): Promise<string> {
  return waitFor(
    async () => {
      const links = await readResetLinks(email);
      return links.length === count ? links.at(-1) : null;
    },
    { description: `reset link ${String(count)} for ${email}` },
  );
}

async function setNewPassword(page: Page, link: string, password: string): Promise<void> {
  await page.goto(link);
  await page.getByLabel(copy.fields.newPassword, { exact: true }).fill(password);
  await page.getByRole("button", { name: copy.resetPassword.submit }).click();
}

/** A successful reset lands on the login page, which confirms it. */
async function expectResetDone(page: Page): Promise<void> {
  await expect(page).toHaveURL("/login?reset=1");
  await expect(page.locator("main").getByRole("status")).toHaveText(copy.resetPassword.success);
}

test("a reset link from the login page sets a new password and ends every session", async ({ page, browser }) => {
  const email = newEmail();
  await createAccount({ email, password: PASSWORD });
  // A second browser stays signed in until the reset.
  const otherPage = await openPageAsNewClient(browser);
  await logIn(otherPage, { copy, email, password: PASSWORD, landingPath: null });
  await expect(otherPage).toHaveURL("/account");

  await page.goto("/login");
  await page.getByRole("link", { name: copy.login.forgotPassword }).click();
  await expect(page).toHaveURL("/forgot-password");
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email.toUpperCase());
  await page.getByRole("button", { name: copy.forgotPassword.submit }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText(SENT_NOTICE);

  const link = await waitForLink(email);
  expect(link).toMatch(/\/reset-password\?token=[A-Za-z0-9_-]{43}$/);
  await page.goto(link);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "same-origin");
  await setNewPassword(page, link, NEW_PASSWORD);
  await expectResetDone(page);

  await otherPage.goto("/account");
  await expect(otherPage).toHaveURL("/login?next=%2Faccount");
  await otherPage.context().close();

  await logIn(page, { copy, email, password: PASSWORD, landingPath: null });
  await expect(page.locator("form").getByRole("alert")).toHaveText(copy.errors.auth.invalid_credentials);
  await logIn(page, { copy, email, password: NEW_PASSWORD, landingPath: null });
  await expect(page).toHaveURL("/account");
});

test("an unknown email gets the same answer and no link", async ({ page }) => {
  const known = newEmail();
  await createAccount({ email: known, password: PASSWORD });
  const unknown = uniqueEmail("e2e-reset-nobody");

  await requestLink(page, unknown);
  await expect(page.locator("main").getByRole("status")).toHaveText(SENT_NOTICE);
  await requestLink(page, known);
  await expect(page.locator("main").getByRole("status")).toHaveText(SENT_NOTICE);
  await waitForLink(known);
  expect(await readResetLinks(unknown)).toEqual([]);
});

test("a link works once, and only the newest one works", async ({ page }) => {
  const email = newEmail();
  await createAccount({ email, password: PASSWORD });

  await requestLink(page, email);
  const first = await waitForLink(email);
  await requestLink(page, email);
  const second = await waitForLink(email, 2);

  await page.goto(first);
  await expect(page.getByText(copy.resetPassword.invalidTitle)).toBeVisible();
  await setNewPassword(page, second, NEW_PASSWORD);
  await expectResetDone(page);
  await page.goto(second);
  await expect(page.getByText(copy.resetPassword.invalidTitle)).toBeVisible();
  await page.getByRole("link", { name: copy.resetPassword.requestNew }).click();
  await expect(page).toHaveURL("/forgot-password");
});

test("a too short password is refused at its field and the link keeps working", async ({ page }) => {
  const email = newEmail();
  await createAccount({ email, password: PASSWORD });
  await requestLink(page, email);
  const link = await waitForLink(email);

  await page.goto(link);
  // The browser's own minLength check would stop the form first; the server check is what is tested.
  await page.getByLabel(copy.fields.newPassword, { exact: true }).evaluate((input) => input.removeAttribute("minlength"));
  await page.getByLabel(copy.fields.newPassword, { exact: true }).fill("short");
  await page.getByRole("button", { name: copy.resetPassword.submit }).click();
  await expect(page.getByText(copy.errors.auth.password_too_short)).toBeVisible();
  await page.getByLabel(copy.fields.newPassword, { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: copy.resetPassword.submit }).click();
  await expectResetDone(page);
});

test("a made-up token shows the invalid link page", async ({ page }) => {
  await page.goto(`/reset-password?token=${"C".repeat(43)}`);
  await expect(page.getByText(copy.resetPassword.invalidTitle)).toBeVisible();
  await page.goto("/reset-password");
  await expect(page.getByText(copy.resetPassword.invalidTitle)).toBeVisible();
});

test("the password-reset-account limit stops mail bombing one address", async ({ page }) => {
  const email = uniqueEmail("e2e-reset-flood");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await requestLink(page, email);
    await expect(page.locator("main").getByRole("status")).toHaveText(SENT_NOTICE);
  }
  await requestLink(page, email);
  await expect(page.locator("form").getByRole("alert")).toHaveText(copy.errors.security.rate_limited);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("request and reset work as plain HTML forms", async ({ page }) => {
    const email = newEmail();
    await createAccount({ email, password: PASSWORD });
    await requestLink(page, email);
    await expect(page.locator("main").getByRole("status")).toHaveText(SENT_NOTICE);
    await setNewPassword(page, await waitForLink(email), NEW_PASSWORD);
    await expectResetDone(page);
    await logIn(page, { copy, email, password: NEW_PASSWORD, landingPath: null });
    await expect(page).toHaveURL("/account");
  });
});
