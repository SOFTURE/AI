// Mail of @softure-ai/mailing on the built app: a signed-in user sends a test mail to their own
// address from /account/mail; the example's fake provider writes it to the outbox file the e2e
// reads (MAIL_OUTBOX, softure.config.ts). Every test gets its own client address and account.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { clientAddressHeaders, uniqueEmail } from "@softure-ai/testing/playwright";
import { inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX } from "./outbox.ts";

const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];

function newEmail(): string {
  const email = uniqueEmail("e2e-mail");
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

async function signIn(page: Page, email: string): Promise<void> {
  await createSignedInAccount(page, { email, password: PASSWORD });
}

test("a signed-in user sends a test mail to their own address, captured with the configured sender", async ({ page }) => {
  const email = newEmail();
  await signIn(page, email);
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
  await signIn(page, email);
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
