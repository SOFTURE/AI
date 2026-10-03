// Password reset mail of @softure-ai/auth through @softure-ai/mailing on the built app: the request
// page, the mail `mailingResetSender()` hands to the fake provider (outbox file, MAIL_OUTBOX), the
// link in it and the new password. Every test gets its own client address and its own account.
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { renderPasswordResetMail } from "@softure-ai/auth/mailing";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { inArray } from "drizzle-orm";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX, readResetLinks } from "./outbox.ts";

const copy = authMessages.en;
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new passphrase";
const createdEmails: string[] = [];

function randomAddress(): string {
  return `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

function newEmail(): string {
  const email = `e2e-reset-mail-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

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

async function register(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(copy.fields.consent).check();
  await page.getByRole("button", { name: copy.register.submit }).click();
  await expect(page).toHaveURL("/account");
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
  await expect.poll(async () => (await readMailOutbox(MAIL_OUTBOX, { to: email })).length, { timeout: 10_000 }).toBe(1);
  const [link] = await readResetLinks(email);
  if (link === undefined) throw new Error(`no reset link mailed to ${email}`);
  const [mail] = await readMailOutbox(MAIL_OUTBOX, { to: email });
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
