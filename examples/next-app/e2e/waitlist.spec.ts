// @softure-ai/waitlist on the built app, with double opt-in: the form on the home page stores a
// request and mails a confirmation link, and nothing counts until it is used; the link records each
// consent in privacy.consents with its document version and sends one welcome mail as list mail; a
// second request widens the scopes through its own link; the welcome mail's footer link
// unsubscribes the address, withdrawing the consents; signing up again lifts the opt-out only once
// the new link is used. Both mails carry an HTML body in the app's layout. Every test gets its own
// client address and email.
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { deliveries, mailingMessages, suppressions } from "@softure-ai/mailing";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { consents } from "@softure-ai/privacy";
import { getEmailKey, getLegalDocument } from "@softure-ai/privacy/server";
import { signups, waitlistMessages } from "@softure-ai/waitlist";
import { asc, eq, inArray, like } from "drizzle-orm";
import { en } from "../messages/en.ts";
import config from "../softure.config.ts";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX } from "./outbox.ts";

const copy = waitlistMessages.en;
const createdEmails: string[] = [];

function newEmail(): string {
  const email = `e2e-waitlist-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

test.beforeEach(({ context }) =>
  context.setExtraHTTPHeaders({ "cf-connecting-ip": `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}` }),
);

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    const keys = createdEmails.map(getEmailKey);
    const rows = await database.db.select({ id: signups.id }).from(signups).where(inArray(signups.email, createdEmails));
    for (const { id } of rows) await database.db.delete(deliveries).where(like(deliveries.scope, `waitlist.welcome:${id}`));
    await database.db.delete(signups).where(inArray(signups.email, createdEmails));
    await database.db.delete(consents).where(inArray(consents.emailKey, keys));
    // mailing keys its rows by the same SHA-256 of the normalised address.
    await database.db.delete(suppressions).where(inArray(suppressions.recipientKey, keys));
  } finally {
    await database.close();
  }
});

async function signUp(page: Page, email: string, { withNewsletter }: { withNewsletter: boolean }): Promise<void> {
  await page.goto("/");
  await page.getByLabel(copy.form.email).fill(email);
  await page.getByLabel(en.waitlist.launch).check();
  if (withNewsletter) await page.getByLabel(en.waitlist.newsletter).check();
  await page.getByRole("button", { name: copy.form.submit }).click();
  await expect(page.getByText(copy.form.confirmationSent)).toBeVisible();
}

async function readSignup(email: string) {
  const database = await openTestDatabase();
  try {
    const [signup] = await database.db.select().from(signups).where(eq(signups.email, email));
    const recorded = await database.db
      .select({ purpose: consents.purpose, granted: consents.granted, documentVersion: consents.documentVersion, source: consents.source })
      .from(consents)
      .where(eq(consents.emailKey, getEmailKey(email)))
      .orderBy(asc(consents.recordedAt), asc(consents.id));
    return { signup, consents: recorded };
  } finally {
    await database.close();
  }
}

async function readSuppressions(email: string) {
  const database = await openTestDatabase();
  try {
    return await database.db.select().from(suppressions).where(eq(suppressions.recipientKey, getEmailKey(email)));
  } finally {
    await database.close();
  }
}

async function readMails(email: string, subject: string) {
  return (await readMailOutbox(MAIL_OUTBOX, { to: email })).filter((mail) => mail.subject === subject);
}

/** The link of confirmation mail number `count`; the action sends after its answer, so this waits for it. */
async function readConfirmationLink(email: string, count = 1): Promise<string> {
  await expect.poll(async () => (await readMails(email, copy.confirmationMail.subject)).length).toBe(count);
  const link = (await readMails(email, copy.confirmationMail.subject)).at(-1)?.text.split("\n").at(-1) ?? "";
  expect(link).toMatch(/\/waitlist\/confirm\?token=[A-Za-z0-9_-]{43}$/);
  return link;
}

async function confirm(page: Page, link: string): Promise<void> {
  await page.goto(link);
  await page.getByRole("button", { name: copy.confirm.submit }).click();
  await expect(page.getByRole("heading", { name: copy.confirm.doneTitle })).toBeVisible();
}

/** The welcome mail(s) sent to `email`; the confirm action sends after its answer, so this waits for one. */
async function readWelcomeMails(email: string) {
  await expect.poll(async () => (await readMails(email, copy.welcomeMail.subject)).length).toBeGreaterThan(0);
  return readMails(email, copy.welcomeMail.subject);
}

async function unsubscribeThroughWelcomeMail(page: Page, email: string): Promise<void> {
  const [mail] = await readWelcomeMails(email);
  const link = mail?.text.split("\n").at(-1) ?? "";
  expect(link).toMatch(/\/unsubscribe\?r=/);
  await page.goto(link);
  await page.getByRole("button", { name: mailingMessages.en.unsubscribe.submit }).click();
  await expect(page.getByRole("heading", { name: mailingMessages.en.unsubscribe.doneTitle })).toBeVisible();
}

test("a sign-up waits for its link: it records no consent and gets no list mail", async ({ page }) => {
  const email = newEmail();
  await signUp(page, email, { withNewsletter: false });
  await readConfirmationLink(email);

  const { signup, consents: recorded } = await readSignup(email);
  expect(signup).toMatchObject({ scopes: ["launch"], placement: "home", locale: config.locale, confirmedAt: null, pendingScopes: ["launch"] });
  expect(recorded).toEqual([]);
  // The answer is out before the mail; give a welcome mail the time it would need, then count.
  await page.waitForTimeout(500);
  expect(await readMails(email, copy.welcomeMail.subject)).toEqual([]);
});

test("the link records the consent, counts the sign-up and sends one welcome mail, also on a second click", async ({ page }) => {
  const email = newEmail();
  await signUp(page, email, { withNewsletter: false });
  const link = await readConfirmationLink(email);
  await confirm(page, link);

  const { signup, consents: recorded } = await readSignup(email);
  expect(signup).toMatchObject({ scopes: ["launch"], pendingScopes: null });
  expect(signup?.confirmedAt).toBeInstanceOf(Date);
  expect(recorded).toEqual([{ purpose: "launch", granted: true, documentVersion: getLegalDocument(config, "privacy-policy").version, source: "waitlist" }]);
  const mails = await readWelcomeMails(email);
  expect(mails).toHaveLength(1);
  expect(mails[0]?.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

  // Both HTML bodies use the app's layout (lib/waitlist-mail.ts); the anchor is the text's link.
  const [confirmationMail] = await readMails(email, copy.confirmationMail.subject);
  expect(confirmationMail?.html).toContain(`<h1 data-app-mail="confirmation">${en.meta.title}</h1>`);
  expect(confirmationMail?.html).toContain(`<p><a href="${link}">${copy.confirmationMail.action}</a></p>`);
  expect(mails[0]?.html).toContain(`<h1 data-app-mail="welcome">${en.meta.title}</h1>`);
  expect(mails[0]?.html).toMatch(/<a href="[^"]+\/unsubscribe\?r=[^"]+">[^<]+<\/a><\/p>\n<\/body>\n<\/html>$/);

  await confirm(page, link);
  await page.waitForTimeout(500);
  expect(await readMails(email, copy.welcomeMail.subject)).toHaveLength(1);
  expect((await readSignup(email)).consents).toHaveLength(1);
});

test("a link that does not work says so", async ({ page }) => {
  await page.goto(`/waitlist/confirm?token=${"A".repeat(43)}`);
  await page.getByRole("button", { name: copy.confirm.submit }).click();
  await expect(page.getByRole("heading", { name: copy.confirm.invalidTitle })).toBeVisible();
});

test("signing up again widens the scopes through its own link, records only the new consent and sends no second welcome mail", async ({ page }) => {
  const email = newEmail();
  await signUp(page, email, { withNewsletter: false });
  await confirm(page, await readConfirmationLink(email));
  await readWelcomeMails(email);

  await signUp(page, email.toUpperCase(), { withNewsletter: true });
  const link = await readConfirmationLink(email, 2);
  expect((await readSignup(email)).signup?.scopes).toEqual(["launch"]);
  await confirm(page, link);

  const { signup, consents: recorded } = await readSignup(email);
  expect(signup?.scopes).toEqual(["launch", "newsletter"]);
  expect(recorded.map((row) => row.purpose)).toEqual(["launch", "newsletter"]);
  await page.waitForTimeout(500);
  expect(await readMails(email, copy.welcomeMail.subject)).toHaveLength(1);
});

test("the welcome mail's footer link unsubscribes the address from list mail", async ({ page }) => {
  const email = newEmail();
  await signUp(page, email, { withNewsletter: true });
  await confirm(page, await readConfirmationLink(email));
  await unsubscribeThroughWelcomeMail(page, email);

  expect(await readSuppressions(email)).toHaveLength(1);
  const { consents: recorded } = await readSignup(email);
  expect(recorded.map((row) => `${row.purpose} ${String(row.granted)} ${row.source}`)).toEqual([
    "launch true waitlist",
    "newsletter true waitlist",
    "launch false unsubscribe",
    "newsletter false unsubscribe",
  ]);
});

test("signing up again after unsubscribing lifts the opt-out only through the link, granting what is checked now", async ({ page }) => {
  const email = newEmail();
  await signUp(page, email, { withNewsletter: true });
  await confirm(page, await readConfirmationLink(email));
  await unsubscribeThroughWelcomeMail(page, email);

  // The confirmation mail is transactional: it reaches the address that opted out.
  await signUp(page, email, { withNewsletter: false });
  const link = await readConfirmationLink(email, 2);
  expect(await readSuppressions(email)).toHaveLength(1);

  await confirm(page, link);
  const { signup, consents: recorded } = await readSignup(email);
  expect(signup?.scopes).toEqual(["launch"]);
  expect(recorded.map((row) => `${row.purpose} ${String(row.granted)}`)).toEqual(["launch true", "newsletter true", "launch false", "newsletter false", "launch true"]);
  expect(await readSuppressions(email)).toEqual([]);
});

test("the form refuses an address that is not one, keeping what was checked", async ({ page }) => {
  await page.goto("/");
  const field = page.getByLabel(copy.form.email);
  // Past the browser's own check, to reach the server's.
  await page.locator("form", { has: field }).evaluate((form) => form.setAttribute("novalidate", ""));
  await field.fill("not-an-address");
  await page.getByLabel(en.waitlist.launch).check();
  await page.getByRole("button", { name: copy.form.submit }).click();
  await expect(page.getByText(copy.errors.waitlist.email_invalid)).toBeVisible();
  await expect(page.getByLabel(en.waitlist.launch)).toBeChecked();
});
