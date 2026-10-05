// Password reset mail of @softure-ai/auth through @softure-ai/mailing on the built app: the request
// page, the mail `mailingResetSender()` hands to the fake provider (outbox file, MAIL_OUTBOX), the
// link in it and the new password. Every test gets its own client address and its own account.
import { expect, test, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { renderPasswordResetMail } from "@softure-ai/auth/mailing";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { clientAddressHeaders, registerAccount, uniqueEmail, waitFor } from "@softure-ai/testing/playwright";
import { inArray } from "drizzle-orm";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX, readResetLinks } from "./outbox.ts";

const copy = authMessages.en;
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new passphrase";
const createdEmails: string[] = [];

function newEmail(): string {
  const email = uniqueEmail("e2e-reset-mail");
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

async function register(page: Page, email: string): Promise<void> {
  await registerAccount(page, { copy, email, password: PASSWORD });
}

test("a reset request mails the rendered reset mail, and its link sets a new password", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.context().clearCookies();

  await page.goto("/forgot-password");
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByRole("button", { name: copy.forgotPassword.submit }).click();
  await expect(page.locator("main").getByRole("status")).toBeVisible();

  // The sender runs after the response.
  const [mail] = await waitFor(
    async () => {
      const mails = await readMailOutbox(MAIL_OUTBOX, { to: email });
      return mails.length === 1 ? mails : null;
    },
    { description: `the reset mail to ${email}` },
  );
  const [link] = await readResetLinks(email);
  if (link === undefined) throw new Error(`no reset link mailed to ${email}`);
  expect(mail).toEqual({
    id: expect.stringMatching(/^fake-\d+-/) as unknown,
    from: "SOFTURE example <hello@mail.example.com>",
    to: email,
    replyTo: "support@example.com",
    ...renderPasswordResetMail(copy, "en", { link, ttlMinutes: 60 }),
    headers: {},
    idempotencyKey: null,
  });

  await page.setContent(mail?.html ?? "");
  const href = await page.getByRole("link", { name: copy.resetMail.action }).getAttribute("href");
  expect(href).toBe(link);
  await page.goto(link);
  await page.getByLabel(copy.fields.newPassword, { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: copy.resetPassword.submit }).click();
  await expect(page).toHaveURL("/login?reset=1");

  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: copy.login.submit }).click();
  await expect(page).toHaveURL("/account");
});
