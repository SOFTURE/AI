// The limiter's arithmetic on a real Postgres (PGlite). The first block is FIRE_TRACKER's
// `src/db/auth-attempts.test.ts`, the behaviour baseline of roadmap item ID-2.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consumeRateLimit, pruneRateLimits, resetRateLimit } from "@softure-ai/security/server";
import { countRows, createTestSecurity, FIRE_BUCKETS, MINUTE_MS, NOW, type TestSecurity } from "./support.js";

const IP = "ip:203.0.113.7";

async function consumeTimes(test: TestSecurity, bucket: string, key: string, times: number): Promise<void> {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await consumeRateLimit(test.ctx, { bucket, key });
  }
}

describe("consumeRateLimit: FIRE_TRACKER baseline", () => {
  let test: TestSecurity;

  beforeEach(async () => {
    test = await createTestSecurity();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("allows attempts up to the limit and rejects the next one", async () => {
    const { limit } = FIRE_BUCKETS.register;
    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const result = await consumeRateLimit(test.ctx, { bucket: "register", key: IP });
      expect(result, `attempt ${String(attempt)} of ${String(limit)}`).toEqual({
        ok: true,
        value: { remaining: limit - attempt, resetAt: new Date(NOW.getTime() + 15 * MINUTE_MS) },
      });
    }

    const over = await consumeRateLimit(test.ctx, { bucket: "register", key: IP });
    expect(over).toEqual({
      ok: false,
      error: "security.rate_limited",
      retryAfterSeconds: 15 * 60,
      resetAt: new Date(NOW.getTime() + 15 * MINUTE_MS),
    });
  });

  it("counts every key separately", async () => {
    await consumeTimes(test, "register", IP, FIRE_BUCKETS.register.limit + 1);
    const other = await consumeRateLimit(test.ctx, { bucket: "register", key: "ip:198.51.100.4" });
    expect(other.ok).toBe(true);
  });

  it("counts every bucket separately", async () => {
    await consumeTimes(test, "register", IP, FIRE_BUCKETS.register.limit + 1);
    const login = await consumeRateLimit(test.ctx, { bucket: "login", key: IP });
    expect(login.ok).toBe(true);
  });

  it("allows as many logins as FIRE_TRACKER's integration suite makes from one address (29)", async () => {
    for (let attempt = 1; attempt <= 29; attempt += 1) {
      const result = await consumeRateLimit(test.ctx, { bucket: "login", key: IP });
      expect(result.ok, `login ${String(attempt)} of 29`).toBe(true);
    }
  });

  it("rejects the mcp bucket only past its limit, not before", async () => {
    const { limit } = FIRE_BUCKETS.mcp;
    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const result = await consumeRateLimit(test.ctx, { bucket: "mcp", key: IP });
      expect(result.ok, `request ${String(attempt)} of ${String(limit)}`).toBe(true);
    }
    const over = await consumeRateLimit(test.ctx, { bucket: "mcp", key: IP });
    expect(over.ok).toBe(false);
  });

  it("starts from zero once the previous window has expired", async () => {
    await consumeTimes(test, "register", IP, FIRE_BUCKETS.register.limit + 1);
    test.clock.advance(15 * MINUTE_MS + 1_000);

    const result = await consumeRateLimit(test.ctx, { bucket: "register", key: IP });
    expect(result).toEqual({
      ok: true,
      value: { remaining: FIRE_BUCKETS.register.limit - 1, resetAt: new Date(test.clock.now().getTime() + 15 * MINUTE_MS) },
    });
  });

  it("opens the new window exactly at the reported resetAt", async () => {
    await consumeTimes(test, "register", IP, FIRE_BUCKETS.register.limit + 1);
    test.clock.set(new Date(NOW.getTime() + 15 * MINUTE_MS));

    expect((await consumeRateLimit(test.ctx, { bucket: "register", key: IP })).ok).toBe(true);
  });

  it("keeps one row per key however many attempts there are", async () => {
    await consumeTimes(test, "register", IP, 40);
    expect(await countRows(test.database)).toBe(1);
  });

  it("forgets a key's attempts after resetRateLimit", async () => {
    await consumeTimes(test, "login", IP, FIRE_BUCKETS.login.limit + 1);
    await resetRateLimit(test.ctx, { bucket: "login", key: IP });

    const result = await consumeRateLimit(test.ctx, { bucket: "login", key: IP });
    expect(result).toMatchObject({ ok: true, value: { remaining: FIRE_BUCKETS.login.limit - 1 } });
  });

  it("deletes rows from long-expired windows and keeps fresh ones", async () => {
    await consumeRateLimit(test.ctx, { bucket: "register", key: "ip:198.51.100.4" });
    test.clock.advance(60 * MINUTE_MS);
    await consumeRateLimit(test.ctx, { bucket: "register", key: IP });

    await pruneRateLimits(test.ctx);
    const rows = await test.database.client.query<{ identifier: string }>("SELECT identifier FROM security.rate_limits");
    expect(rows.rows).toEqual([{ identifier: IP }]);
  });
});

describe("consumeRateLimit: buckets from configuration", () => {
  let test: TestSecurity | undefined;

  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  it("uses each bucket's own window", async () => {
    test = await createTestSecurity({ buckets: { short: { limit: 1, windowMinutes: 1 }, long: { limit: 1, windowMinutes: 60 } } });
    await consumeRateLimit(test.ctx, { bucket: "short", key: IP });
    await consumeRateLimit(test.ctx, { bucket: "long", key: IP });
    test.clock.advance(2 * MINUTE_MS);

    expect((await consumeRateLimit(test.ctx, { bucket: "short", key: IP })).ok).toBe(true);
    expect(await consumeRateLimit(test.ctx, { bucket: "long", key: IP })).toMatchObject({
      ok: false,
      retryAfterSeconds: 58 * 60,
    });
  });

  it("rounds the retry delay up to whole seconds and never below one", async () => {
    test = await createTestSecurity({ buckets: { once: { limit: 1, windowMinutes: 1 } } });
    await consumeRateLimit(test.ctx, { bucket: "once", key: IP });
    test.clock.advance(MINUTE_MS - 1);

    expect(await consumeRateLimit(test.ctx, { bucket: "once", key: IP })).toMatchObject({ ok: false, retryAfterSeconds: 1 });
  });

  it("stops the counter at limit + 1 during a flood", async () => {
    test = await createTestSecurity({ buckets: { tiny: { limit: 2, windowMinutes: 15 } } });
    await consumeTimes(test, "tiny", IP, 30);

    const rows = await test.database.client.query<{ attempts: number }>("SELECT attempts FROM security.rate_limits");
    expect(rows.rows).toEqual([{ attempts: 3 }]);
  });

  it("cleans up expired rows on the consume path when nobody resets anything", async () => {
    test = await createTestSecurity({ cleanupProbability: 1 });
    await consumeRateLimit(test.ctx, { bucket: "login", key: "ip:192.0.2.1" });
    test.clock.advance(60 * MINUTE_MS);
    await consumeRateLimit(test.ctx, { bucket: "login", key: IP });

    const rows = await test.database.client.query<{ identifier: string }>("SELECT identifier FROM security.rate_limits");
    expect(rows.rows).toEqual([{ identifier: IP }]);
  });

  it("does not clean up on the consume path when the probability is 0", async () => {
    test = await createTestSecurity({ cleanupProbability: 0 });
    await consumeRateLimit(test.ctx, { bucket: "login", key: "ip:192.0.2.1" });
    test.clock.advance(60 * MINUTE_MS);
    await consumeRateLimit(test.ctx, { bucket: "login", key: IP });

    expect(await countRows(test.database)).toBe(2);
  });

  it("still answers when the cleanup fails, and logs only the kind of error", async () => {
    test = await createTestSecurity({ cleanupProbability: 1 });
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args.join(" "));
    // A trigger that refuses deletes stands in for a cleanup that fails (a lock timeout, a lost row).
    await test.database.client.exec(`
      CREATE FUNCTION security.refuse_delete() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'delete refused'; END $$;
      CREATE TRIGGER refuse_delete BEFORE DELETE ON security.rate_limits FOR EACH STATEMENT
        EXECUTE FUNCTION security.refuse_delete();
    `);
    try {
      const result = await consumeRateLimit(test.ctx, { bucket: "login", key: IP });
      expect(result).toMatchObject({ ok: true, value: { remaining: FIRE_BUCKETS.login.limit - 1 } });
      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toMatch(/^@softure-ai\/security: rate limit cleanup failed: \w+/);
      expect(String(errors[0])).not.toContain("delete refused");
    } finally {
      console.error = original;
    }
  });

  it("prunes rows of a bucket no longer configured after two of the longest windows", async () => {
    test = await createTestSecurity({ buckets: { kept: { limit: 5, windowMinutes: 10 }, longest: { limit: 5, windowMinutes: 30 } } });
    await test.database.client.query(
      "INSERT INTO security.rate_limits (bucket, identifier, attempts, window_started_at) VALUES ('removed', $1, 1, $2), ('removed', $3, 1, $4)",
      ["ip:192.0.2.1", new Date(NOW.getTime() - 61 * MINUTE_MS), "ip:192.0.2.2", new Date(NOW.getTime() - 59 * MINUTE_MS)],
    );

    await pruneRateLimits(test.ctx);
    const rows = await test.database.client.query<{ identifier: string }>("SELECT identifier FROM security.rate_limits");
    expect(rows.rows).toEqual([{ identifier: "ip:192.0.2.2" }]);
  });
});

describe("consumeRateLimit: programming errors", () => {
  let test: TestSecurity;

  beforeEach(async () => {
    test = await createTestSecurity();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("throws on a bucket the configuration does not define, naming it", async () => {
    await expect(consumeRateLimit(test.ctx, { bucket: "logn", key: IP })).rejects.toThrow(
      '@softure-ai/security: unknown rate limit bucket "logn"; configured buckets: register, login, mcp, waitlist',
    );
  });

  it("throws on an inherited property name used as a bucket", async () => {
    await expect(consumeRateLimit(test.ctx, { bucket: "toString", key: IP })).rejects.toThrow('unknown rate limit bucket "toString"');
  });

  it("throws on an empty key and on a key over 200 characters", async () => {
    await expect(consumeRateLimit(test.ctx, { bucket: "login", key: "" })).rejects.toThrow("got 0");
    await expect(consumeRateLimit(test.ctx, { bucket: "login", key: "x".repeat(201) })).rejects.toThrow("got 201");
    expect((await consumeRateLimit(test.ctx, { bucket: "login", key: "x".repeat(200) })).ok).toBe(true);
  });

  it("throws when the app did not enable the module", async () => {
    const ctx = { ...test.ctx, config: { ...test.ctx.config, modules: [] } };
    await expect(consumeRateLimit(ctx, { bucket: "login", key: IP })).rejects.toThrow(
      "@softure-ai/security: the module is not enabled; add security({ ... }) to modules in softure.config.ts",
    );
  });
});
