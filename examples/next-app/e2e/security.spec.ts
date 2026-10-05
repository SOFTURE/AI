// @softure-ai/security on the built app: the rate limit, client identification and the body cap
// of app/api/security/ping/route.ts, with the counter read back from Postgres.
import { expect, test } from "@playwright/test";
import { rateLimits } from "@softure-ai/security";
import { clientAddressHeaders, randomClientAddress } from "@softure-ai/testing/playwright";
import { and, eq } from "drizzle-orm";
import { openTestDatabase } from "./database.ts";

const PING = "/api/security/ping";
const BUCKET = "example.ping";

async function readAttempts(address: string): Promise<number[]> {
  const database = await openTestDatabase();
  try {
    const rows = await database.db
      .select()
      .from(rateLimits)
      .where(and(eq(rateLimits.bucket, BUCKET), eq(rateLimits.identifier, `ip:${address}`)));
    return rows.map((row) => row.attempts);
  } finally {
    await database.close();
  }
}

test("three pings pass, the fourth gets 429 with Retry-After, and another address still passes", async ({ request }) => {
  const address = randomClientAddress();
  const headers = { "cf-connecting-ip": address };

  for (const remaining of [2, 1, 0]) {
    const response = await request.post(PING, { headers, data: "hello" });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ remaining, body: "hello" });
  }

  const rejected = await request.post(PING, { headers, data: "hello" });
  expect(rejected.status()).toBe(429);
  expect(await rejected.json()).toEqual({ error: "security.rate_limited" });
  const retryAfter = Number(rejected.headers()["retry-after"]);
  expect(retryAfter).toBeGreaterThan(14 * 60);
  expect(retryAfter).toBeLessThanOrEqual(15 * 60);

  // One row for the client, its counter stopped at limit + 1.
  expect(await readAttempts(address)).toEqual([4]);

  const other = await request.post(PING, { headers: clientAddressHeaders(), data: "hello" });
  expect(other.status()).toBe(200);
});

test("a ping without CF-Connecting-IP is refused as unidentified, not counted in a shared bucket", async ({ request }) => {
  const response = await request.post(PING, { data: "hello" });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "security.client_unidentified" });
});

test("a body over 64 bytes gets 413", async ({ request }) => {
  const response = await request.post(PING, { headers: clientAddressHeaders(), data: "x".repeat(65) });
  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ error: "security.body_too_large" });
});
