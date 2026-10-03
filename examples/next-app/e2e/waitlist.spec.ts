// @softure-ai/waitlist on the built app: the form on the home page signs an address up with the
// required scope, a second sign-up widens it to the newsletter, each consent lands in
// privacy.consents with its document version, one welcome mail goes out as list mail, and its
// footer link unsubscribes the address. Every test gets its own client address and email.
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
  await expect(page.getByText(copy.form.success)).toBeVisible();
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

/** The welcome mail(s) sent to `email`; the action sends after its answer, so this waits for one. */
async function readWelcomeMails(email: string) {
  await expect.poll(async () => (await readMailOutbox(MAIL_OUTBOX, { to: email })).length).toBeGreaterThan(0);
  return readMailOutbox(MAIL_OUTBOX, { to: email });
}

test("a sign-up stores the address with its scope, records the consent and sends one welcome mail", async ({ page }) => {
  const email = newEmail();
  await signUp(page, email, { withNewsletter: false });

  const { signup, consents: recorded } = await readSignup(email);
  expect(signup).toMatchObject({ scopes: ["launch"], placement: "home", locale: config.locale });
  expect(recorded).toEqual([{ purpose: "launch", granted: true, documentVersion: getLegalDocument(config, "privacy-policy").version, source: "waitlist" }]);

  const mails = await readWelcomeMails(email);
  expect(mails).toHaveLength(1);
  expect(mails[0]?.subject).toBe(copy.welcomeMail.subject);
  expect(mails[0]?.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
});

test("signing up again widens the scopes, records only the new consent and sends no second mail", async ({ page }) => {
  const email = newEmail();
  await signUp(page, email, { withNewsletter: false });
  await readWelcomeMails(email);

  await signUp(page, email.toUpperCase(), { withNewsletter: true });
  const { signup, consents: recorded } = await readSignup(email);
  expect(signup?.scopes).toEqual(["launch", "newsletter"]);
  expect(recorded.map((row) => row.purpose)).toEqual(["launch", "newsletter"]);
  // The answer is out before the mail; give a second mail the time it would need, then count.
  await page.waitForTimeout(500);
  expect(await readMailOutbox(MAIL_OUTBOX, { to: email })).toHaveLength(1);
});

test("the welcome mail's footer link unsubscribes the address from list mail", async ({ page }) => {
  const email = newEmail();
  await signUp(page, email, { withNewsletter: true });
  const [mail] = await readWelcomeMails(email);
  const link = mail?.text.split("\n").at(-1) ?? "";
  expect(link).toMatch(/\/unsubscribe\?r=/);

  await page.goto(link);
  await page.getByRole("button", { name: mailingMessages.en.unsubscribe.submit }).click();
  await expect(page.getByRole("heading", { name: mailingMessages.en.unsubscribe.doneTitle })).toBeVisible();

  const database = await openTestDatabase();
  try {
    const rows = await database.db.select().from(suppressions).where(eq(suppressions.recipientKey, getEmailKey(email)));
    expect(rows).toHaveLength(1);
  } finally {
    await database.close();
  }
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
