// Mail of @softure-ai/mailing on the built app: a signed-in user sends a test mail to their own
// address from /account/mail; the example's fake provider writes it to the outbox file the e2e
// reads (MAIL_OUTBOX, softure.config.ts). Every test gets its own client address and account.
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX } from "./outbox.ts";

const authCopy = authMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];

function randomAddress(): string {
  return `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

function newEmail(): string {
  const email = `e2e-mail-${randomUUID()}@example.com`;
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
  await page.getByLabel(authCopy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(authCopy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(authCopy.fields.consent).check();
  await page.getByRole("button", { name: authCopy.register.submit }).click();
  await expect(page).toHaveURL("/account");
}

test("a signed-in user sends a test mail to their own address, captured with the configured sender", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.getByRole("link", { name: en.account.testMail }).click();
  await expect(page).toHaveURL("/account/mail");

  const subject = `Hello ${randomUUID()}`;
  await page.getByLabel(en.mail.subjectLabel).fill(subject);
  await page.getByRole("button", { name: en.mail.submit }).click();
  await expect(page.getByRole("status")).toHaveText(en.mail.sent);

  const mails = await readMailOutbox(MAIL_OUTBOX, { to: email });
  expect(mails).toHaveLength(1);
  const [mail] = mails;
  expect(mail).toEqual({
    id: expect.stringMatching(/^fake-\d+-/) as unknown,
    from: "SOFTURE example <hello@mail.example.com>",
    to: email,
    replyTo: "support@example.com",
    subject,
    text: en.mail.body,
    html: `<p>${en.mail.body}</p>`,
    headers: {},
    idempotencyKey: expect.stringMatching(/^example-test-mail:[0-9a-f-]{36}:[0-9a-f-]{36}$/) as unknown,
  });
});

test("a blank subject is refused at the boundary and nothing is sent", async ({ page }) => {
  const email = newEmail();
  await register(page, email);
  await page.goto("/account/mail");

  await page.getByLabel(en.mail.subjectLabel).fill("   ");
  await page.getByRole("button", { name: en.mail.submit }).click();
  await expect(page.locator("form").getByRole("alert").first()).toHaveText(en.errors["mailing.invalid_input"]);
  expect(await readMailOutbox(MAIL_OUTBOX, { to: email })).toEqual([]);
});

test("the page is closed to anonymous visitors", async ({ page }) => {
  await page.goto("/account/mail");
  await expect(page).toHaveURL("/login?next=%2Faccount%2Fmail");
});
