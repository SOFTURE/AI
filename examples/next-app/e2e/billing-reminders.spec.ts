// @softure-ai/billing's reminder mail on the built app: an account whose trial ends in two days
// gets one "trial ends" mail from the script a scheduler runs (npm run access-reminders), a second
// run sends nothing new, and once the trial is over the next run sends one "trial has ended" mail.
// Mail lands in the fake provider's outbox; the account is this test's own.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { billingMessages, entitlements } from "@softure-ai/billing";
import { readMailOutbox } from "@softure-ai/mailing/testing";
import { clientAddressHeaders, uniqueEmail } from "@softure-ai/testing/playwright";
import { eq, inArray } from "drizzle-orm";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";
import { MAIL_OUTBOX } from "./outbox.ts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const copy = billingMessages.en;
const PASSWORD = "correct horse battery";
const DAY_MS = 24 * 60 * 60 * 1000;
const createdEmails: string[] = [];

test.beforeEach(({ context }) =>
  context.setExtraHTTPHeaders(clientAddressHeaders()),
);

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    // The entitlement rows go with the accounts (ON DELETE CASCADE).
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

/** Moves the account's trial end to `trialEndsAt`, the way time would. */
async function setTrialEnd(email: string, trialEndsAt: Date): Promise<void> {
  const database = await openTestDatabase();
  try {
    const [account] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account === undefined) throw new Error(`setTrialEnd: no account for ${email}`);
    const now = new Date();
    await database.db
      .insert(entitlements)
      .values({ userId: account.id, trialEndsAt, paidUntil: null, isLifetime: false, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: entitlements.userId, set: { trialEndsAt, updatedAt: now } });
  } finally {
    await database.close();
  }
}

/** Moves the account's creation back, as if it had registered at `createdAt`. */
async function moveCreation(email: string, createdAt: Date): Promise<void> {
  const database = await openTestDatabase();
  try {
    await database.db.update(users).set({ createdAt }).where(eq(users.email, email));
  } finally {
    await database.close();
  }
}

/** Runs the app's reminder script against the e2e database and outbox; returns its summary line. */
function runReminderScript(appOrigin: string): string {
  const result = spawnSync("npm", ["run", "--silent", "access-reminders"], {
    cwd: APP_DIR,
    encoding: "utf8",
    env: { ...process.env, APP_ORIGIN: appOrigin, MAIL_OUTBOX },
  });
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  return result.stdout.trim();
}

test("an account is mailed once before its trial ends and once after it has ended", async ({ page, baseURL }) => {
  if (baseURL === undefined) throw new Error("the e2e needs a baseURL");
  const email = uniqueEmail("e2e-reminder");
  createdEmails.push(email);
  await createSignedInAccount(page, { email, password: PASSWORD });

  // Two or three days left (depending on the hour in Warsaw): inside the 3-day reminder window.
  await setTrialEnd(email, new Date(Date.now() + 2 * DAY_MS));
  expect(JSON.parse(runReminderScript(baseURL))).toMatchObject({ rejected: 0 });
  const ending = await readMailOutbox(MAIL_OUTBOX, { to: email });
  expect(ending).toHaveLength(1);
  expect(ending[0]?.subject).toMatch(/^Your trial ends on /);
  expect(ending[0]?.text).toContain(`${copy.notice.choosePlan}: ${baseURL}/payment`);

  runReminderScript(baseURL);
  expect(await readMailOutbox(MAIL_OUTBOX, { to: email })).toHaveLength(1);

  // The trial ran its 14 days: the account is that old, and the trial ended a minute ago.
  await moveCreation(email, new Date(Date.now() - 15 * DAY_MS));
  await setTrialEnd(email, new Date(Date.now() - 60_000));
  runReminderScript(baseURL);
  const mails = await readMailOutbox(MAIL_OUTBOX, { to: email });
  expect(mails.map((mail) => mail.subject)).toEqual([ending[0]?.subject, copy.reminderMail.trialEnded.subject]);
});
