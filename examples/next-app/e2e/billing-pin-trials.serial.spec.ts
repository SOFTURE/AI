// The pin-trials script of @softure-ai/billing on the built app: it reports the derived trials it would
// pin, and a dry run writes none. A serial spec (playwright.config.ts): the script reads and writes every
// account in the database, so it runs while no other spec creates or deletes accounts (issue #505).
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { entitlements } from "@softure-ai/billing";
import { clientAddressHeaders, uniqueEmail } from "@softure-ai/testing/playwright";
import { eq, inArray } from "drizzle-orm";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];

test.beforeEach(({ context }) =>
  context.setExtraHTTPHeaders(clientAddressHeaders()),
);

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

/** Runs the pin-trials script of the example app. */
function runPinTrials(args: readonly string[]): { status: number | null; output: string } {
  const result = spawnSync("npm", ["run", "--silent", "pin-trials", "--", ...args], { cwd: APP_DIR, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("pin-trials reports the derived trials it would pin, and a dry run writes none", async ({ page }) => {
  const email = uniqueEmail("e2e-billing-pin");
  createdEmails.push(email);
  await createSignedInAccount(page, { email, password: PASSWORD });

  const pinned = runPinTrials([]);
  expect(pinned.status, pinned.output).toBe(0);
  expect(pinned.output).toMatch(/^after:\s+\{"accountsWithoutRow":0,"pinned":\d+\}$/m);
  expect(pinned.output).toContain("DRY RUN");
  const database = await openTestDatabase();
  try {
    const [account] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account === undefined) throw new Error(`pin-trials: no account for ${email}`);
    expect(await database.db.select().from(entitlements).where(eq(entitlements.userId, account.id))).toEqual([]);
  } finally {
    await database.close();
  }
});
