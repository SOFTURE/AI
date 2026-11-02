// Issue #935: the token state (a refreshed token, the lease, `reconnect_required` and its hook) is written outside the
// caller's transaction, so a rollback after the provider already answered loses none of it. On a real Postgres
// (tests/postgres.ts); a PGlite transaction, which has no second connection, keeps writing in the transaction.
import type { ReconnectRequiredEvent } from "@softure-ai/connections";
import { getAccessToken, reportCredentialRejected, type ConnectionsContext } from "@softure-ai/connections/server";
import { afterEach, describe, expect, it } from "vitest";
import { connectFake } from "./connect.js";
import { createPostgresConnections, isPostgresRequired, POSTGRES_ADMIN_URL, readState, type CreatePostgresConnectionsOptions, type PostgresConnections } from "./postgres.js";
import { createTestConnections, readRawRow, type TestConnections } from "./support.js";

const HOUR = 3600_000;

class Rollback extends Error {}

/** Runs `step` with the context's `db` set to a transaction that then rolls back; answers what `step` answered. */
async function inRolledBackTransaction<T>(ctx: ConnectionsContext, step: (ctx: ConnectionsContext) => Promise<T>): Promise<T> {
  let answer: { value: T } | undefined;
  try {
    await ctx.db.transaction(async (tx) => {
      answer = { value: await step({ ...ctx, db: tx }) };
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  if (answer === undefined) throw new Error("test: the step did not answer");
  return answer.value;
}

describe("the Postgres server for the rollback tests", () => {
  it.runIf(isPostgresRequired)("is configured in CI", () => {
    expect(POSTGRES_ADMIN_URL).toMatch(/^postgres(ql)?:\/\//);
  });
});

describe.skipIf(POSTGRES_ADMIN_URL === undefined)("token state inside a transaction that rolls back", () => {
  let test: PostgresConnections;
  let events: ReconnectRequiredEvent[];

  async function setUp(options: CreatePostgresConnectionsOptions = {}): Promise<void> {
    events = [];
    test = await createPostgresConnections({ ...options, connections: { onReconnectRequired: (event) => void events.push(event) } });
    await connectFake(test);
  }

  afterEach(async () => {
    await test.close();
  });

  it("keeps a rotated refresh token stored, so the next refresh spends the new one", async () => {
    await setUp({ fake: { rotatesRefreshToken: true } });
    const before = await readState(test);
    test.clock.advance(HOUR);
    const inside = await inRolledBackTransaction(test.ctx, (ctx) => getAccessToken(ctx, { provider: "fake" }));
    expect(inside.ok).toBe(true);
    expect(test.fake.calls.refresh).toBe(1);

    const after = await readState(test);
    expect(after.status).toBe("connected");
    expect(after.leaseId).toBeNull();
    expect(after.credentials).not.toBe(before.credentials);

    // The spent refresh token would answer invalid_grant; the stored one is the rotated token.
    test.clock.advance(HOUR);
    const next = await getAccessToken(test.ctx, { provider: "fake" });
    expect(next.ok).toBe(true);
    expect(test.fake.calls.refresh).toBe(2);
    expect(events).toEqual([]);
  });

  it("keeps reconnect_required after invalid_grant, with the hook run once", async () => {
    await setUp();
    test.fake.revokeGrant();
    test.clock.advance(HOUR);
    const inside = await inRolledBackTransaction(test.ctx, (ctx) => getAccessToken(ctx, { provider: "fake" }));
    expect(inside).toEqual({ ok: false, error: "connections.reconnect_required" });

    expect((await readState(test)).status).toBe("reconnect_required");
    expect(events.map((event) => [event.provider, event.reason])).toEqual([["fake", "invalid_grant"]]);
    // Later attempts stop at the stored state and never call the provider again.
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.reconnect_required" });
    expect(test.fake.calls.refresh).toBe(1);
    expect(events).toHaveLength(1);
  });

  it("keeps reconnect_required after a reported rejection, with the hook run once", async () => {
    await setUp();
    const inside = await inRolledBackTransaction(test.ctx, (ctx) => reportCredentialRejected(ctx, { provider: "fake" }));
    expect(inside).toEqual({ ok: true, value: true });

    expect((await readState(test)).status).toBe("reconnect_required");
    expect(events.map((event) => [event.provider, event.reason])).toEqual([["fake", "rejected"]]);
  });
});

describe("token state inside a PGlite transaction", () => {
  let test: TestConnections;

  afterEach(async () => {
    await test.database.close();
  });

  it("refreshes in the caller's transaction, the only connection there is, without waiting on itself", async () => {
    test = await createTestConnections();
    await connectFake(test);
    const before = await readRawRow(test.database, "fake");
    test.clock.advance(HOUR);
    const inside = await inRolledBackTransaction(test.ctx, (ctx) => getAccessToken(ctx, { provider: "fake" }));
    expect(inside.ok).toBe(true);
    expect(test.fake.calls.refresh).toBe(1);
    // Rolled back with the transaction: PGlite cannot write anywhere else.
    expect((await readRawRow(test.database, "fake")).credentials).toBe(before.credentials);
  });
});
