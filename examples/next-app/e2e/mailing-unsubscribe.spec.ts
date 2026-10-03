// Unsubscribe of @softure-ai/mailing on the built app: a signed-in user sends themselves a test mail
// as list mail (the newsletter option on /account/mail); the fake provider writes it to the outbox.
// The mail carries the RFC 8058 headers and a footer link; unsubscribing through either one makes
// the next list mail fail with mailing.suppressed, while transactional mail still goes out. Every
// test gets its own client address and account.
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { mailingMessages, suppressions } from "@softure-ai/mailing";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX } from "./outbox.ts";

const authCopy = authMessages.en;
const unsubscribeCopy = mailingMessages.en.unsubscribe;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];
const recipientKeys: string[] = [];

function randomAddress(): string {
  return `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

function newEmail(): string {
  const email = `e2e-unsubscribe-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

test.beforeEach(({ context }) => context.setExtraHTTPHeaders({ "cf-connecting-ip": randomAddress() }));

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    await database.db.delete(users).where(inArray(users.email, createdEmails));
    if (recipientKeys.length > 0) await database.db.delete(suppressions).where(inArray(suppressions.recipientKey, recipientKeys));
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

/** Sends a test mail from /account/mail, as a newsletter or not, and returns the subject. */
async function sendTestMail(page: Page, { isNewsletter }: { isNewsletter: boolean }): Promise<string> {
  await page.goto("/account/mail");
  const subject = `Hello ${randomUUID()}`;
  await page.getByLabel(en.mail.subjectLabel).fill(subject);
  if (isNewsletter) await page.getByLabel(en.mail.newsletterLabel).check();
  await page.getByRole("button", { name: en.mail.submit }).click();
  return subject;
}

/** The one list mail sent to `email`, with its unsubscribe links. */
async function readListMail(email: string): Promise<{ oneClick: string; page: string }> {
  const mails = await readMailOutbox(MAIL_OUTBOX, { to: email });
  expect(mails).toHaveLength(1);
  const [mail] = mails;
  const oneClick = /^<(.+)>$/.exec(mail?.headers["List-Unsubscribe"] ?? "")?.[1] ?? "";
  const page = mail?.text.split("\n").at(-1) ?? "";
  const recipientKey = new URL(oneClick).searchParams.get("r");
  if (recipientKey !== null) recipientKeys.push(recipientKey);
  return { oneClick, page };
}

async function expectNewsletterRefused(page: Page, email: string): Promise<void> {
  await sendTestMail(page, { isNewsletter: true });
  await expect(page.locator("form").getByRole("alert").first()).toHaveText(en.errors["mailing.suppressed"]);
  expect(await readMailOutbox(MAIL_OUTBOX, { to: email })).toHaveLength(1);
}

test("a list mail carries the one-click headers and a footer link on the app's origin, without the address", async ({ page, baseURL }) => {
  const email = newEmail();
  await register(page, email);
  await sendTestMail(page, { isNewsletter: true });
  await expect(page.getByRole("status")).toHaveText(en.mail.sent);

  const [mail] = await readMailOutbox(MAIL_OUTBOX, { to: email });
  const query = /\?r=[A-Za-z0-9_-]{43}&t=[A-Za-z0-9_-]{43}$/;
  expect(mail?.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  const { oneClick, page: pageLink } = await readListMail(email);
  expect(oneClick.startsWith(`${baseURL ?? ""}/api/mailing/unsubscribe?`)).toBe(true);
  expect(oneClick).toMatch(query);
  expect(pageLink.startsWith(`${baseURL ?? ""}/unsubscribe?`)).toBe(true);
  expect(pageLink).toMatch(query);
  expect(mail?.text).toContain(`\n-- \n${mailingMessages.en.footer.text}\n`);
  expect(mail?.html).toContain(`<a href="${pageLink.replaceAll("&", "&amp;")}">${mailingMessages.en.footer.htmlLink}</a>`);
  expect(`${oneClick} ${pageLink}`).not.toContain("e2e-unsubscribe");
});

test("a mail client's one-click POST unsubscribes; the next list mail is refused, transactional mail still goes out", async ({ page, request }) => {
  const email = newEmail();
  await register(page, email);
  await sendTestMail(page, { isNewsletter: true });
  await expect(page.getByRole("status")).toHaveText(en.mail.sent);
  const { oneClick } = await readListMail(email);

  // What Gmail sends: a POST from its own servers, no cookies, the RFC 8058 body.
  const response = await request.post(oneClick, {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: "List-Unsubscribe=One-Click",
  });
  expect(response.status()).toBe(200);
  expect((await request.post(oneClick, { data: "List-Unsubscribe=One-Click" })).status()).toBe(200);

  await expectNewsletterRefused(page, email);
  await sendTestMail(page, { isNewsletter: false });
  await expect(page.getByRole("status")).toHaveText(en.mail.sent);
  expect(await readMailOutbox(MAIL_OUTBOX, { to: email })).toHaveLength(2);
});

test("the footer link opens a page that unsubscribes only when its button is pressed", async ({ page, browser }) => {
  const email = newEmail();
  await register(page, email);
  await sendTestMail(page, { isNewsletter: true });
  await expect(page.getByRole("status")).toHaveText(en.mail.sent);
  const { page: pageLink } = await readListMail(email);

  // A fresh browser: no session, as when the link is opened from a mail client.
  const visitor = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": randomAddress() } });
  try {
    const visit = await visitor.newPage();
    await visit.goto(pageLink);
    await expect(visit.getByRole("heading", { name: unsubscribeCopy.title })).toBeVisible();

    // Opening the page changed nothing: a newsletter still goes out.
    await sendTestMail(page, { isNewsletter: true });
    await expect(page.getByRole("status")).toHaveText(en.mail.sent);
    expect(await readMailOutbox(MAIL_OUTBOX, { to: email })).toHaveLength(2);

    await visit.getByRole("button", { name: unsubscribeCopy.submit }).click();
    await expect(visit.getByRole("heading", { name: unsubscribeCopy.doneTitle })).toBeVisible();
    expect(new URL(visit.url()).search).toBe("?status=done");
  } finally {
    await visitor.close();
  }

  await sendTestMail(page, { isNewsletter: true });
  await expect(page.locator("form").getByRole("alert").first()).toHaveText(en.errors["mailing.suppressed"]);
  expect(await readMailOutbox(MAIL_OUTBOX, { to: email })).toHaveLength(2);
});

test("a forged link is refused by the route and by the page, and a GET on the route leads to the page", async ({ page, request }) => {
  const forged = `r=${"A".repeat(43)}&t=${"B".repeat(43)}`;
  expect((await request.post(`/api/mailing/unsubscribe?${forged}`, { data: "List-Unsubscribe=One-Click" })).status()).toBe(400);

  await page.goto(`/api/mailing/unsubscribe?${forged}`);
  await expect(page).toHaveURL(`/unsubscribe?${forged}`);
  await page.getByRole("button", { name: unsubscribeCopy.submit }).click();
  await expect(page.getByRole("heading", { name: unsubscribeCopy.invalidTitle })).toBeVisible();

  await page.goto("/unsubscribe");
  await expect(page.getByRole("heading", { name: unsubscribeCopy.invalidTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: unsubscribeCopy.submit })).toHaveCount(0);
});
