// @softure-ai/analytics funnel on the built app: a tagged visit is counted on the home page (the
// pixel), at sign-up (the onRegistered hook) and on the account page (the beacon), under its
// channel and nothing else; the endpoint refuses steps the browser may not report. Each test uses
// its own channel and deletes its counters afterwards.
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { funnelCounts } from "@softure-ai/analytics";
import { authMessages, users } from "@softure-ai/auth";
import { eq, inArray } from "drizzle-orm";
import { openTestDatabase } from "./database.ts";

const copy = authMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];
const usedChannels: string[] = [];

function newChannel(): string {
  const channel = `e2e-${randomBytes(6).toString("hex")}`;
  usedChannels.push(channel);
  return channel;
}

test.beforeEach(({ context }) =>
  context.setExtraHTTPHeaders({ "cf-connecting-ip": `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}` }),
);

test.afterAll(async () => {
  const database = await openTestDatabase();
  try {
    if (createdEmails.length > 0) await database.db.delete(users).where(inArray(users.email, createdEmails));
    if (usedChannels.length > 0) await database.db.delete(funnelCounts).where(inArray(funnelCounts.channel, usedChannels));
  } finally {
    await database.close();
  }
});

/** The counts of one channel today, by step. */
async function readCounts(channel: string): Promise<Record<string, number>> {
  const database = await openTestDatabase();
  try {
    const rows = await database.db
      .select({ step: funnelCounts.step, count: funnelCounts.count })
      .from(funnelCounts)
      .where(eq(funnelCounts.channel, channel));
    return Object.fromEntries(rows.map((row) => [row.step, Number(row.count)]));
  } finally {
    await database.close();
  }
}

async function register(page: Page, email: string): Promise<void> {
  createdEmails.push(email);
  await page.getByRole("link", { name: copy.login.registerLink }).click();
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(copy.fields.consent).check();
  await page.getByRole("button", { name: copy.register.submit }).click();
  await expect(page.getByTestId("account-email")).toHaveText(email);
}

test("a tagged visit is counted on the home page, at sign-up and on the account page, without a cookie", async ({ page, context }) => {
  const channel = newChannel();
  await page.goto(`/?z=${channel}`);
  await expect.poll(() => readCounts(channel)).toEqual({ landing: 1 });

  await page.goto(`/login?z=${channel}`);
  await register(page, `e2e-funnel-${randomUUID()}@example.com`);
  await expect.poll(() => readCounts(channel)).toEqual({ landing: 1, signup: 1 });
  // The register action's redirect to /account drops the tag (FU-6), so that view counts without a
  // channel; a tagged view of the account page counts under it.
  await page.goto(`/account?z=${channel}`);
  await expect.poll(() => readCounts(channel)).toEqual({ landing: 1, signup: 1, account: 1 });

  const cookies = await context.cookies();
  expect(cookies.filter((cookie) => cookie.value.includes(channel))).toEqual([]);
});

test("the endpoint counts a beacon from the app's page and refuses steps the browser may not report", async ({ request, baseURL }) => {
  const channel = newChannel();
  const fromPage = { referer: `${String(baseURL)}/account?z=${channel}`, "content-type": "text/plain;charset=UTF-8" };

  for (const step of ["signup", "landing", "unknown"]) {
    const refused = await request.post("/api/analytics/funnel", { headers: fromPage, data: `step=${step}` });
    expect(refused.status()).toBe(204);
  }
  const elsewhere = await request.post("/api/analytics/funnel", { headers: { ...fromPage, referer: `https://elsewhere.example.com/?z=${channel}` }, data: "step=account" });
  expect(elsewhere.status()).toBe(204);
  expect(await readCounts(channel)).toEqual({});

  const counted = await request.post("/api/analytics/funnel", { headers: fromPage, data: "step=account" });
  expect(counted.status()).toBe(204);
  expect(counted.headers()["cache-control"]).toBe("no-store");
  expect(await readCounts(channel)).toEqual({ account: 1 });
});

test("the pixel answers an uncached GIF, whoever asks", async ({ request }) => {
  const response = await request.get("/api/analytics/funnel?step=landing");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/gif");
  expect(response.headers()["cache-control"]).toBe("no-store");
});
