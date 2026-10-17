// The SQL surface of migration 0012 against the state machine: `billing.entitlement_states` and
// `billing.entitlement_state` must answer what `getEntitlement` answers, for accounts with and
// without a row, at random instants and at every end itself, under several trial policies.
import { getEntitlement, getEntitlementStatesSql, type BillingContext } from "@softure-ai/billing/server";
import { createTestEntitlement } from "@softure-ai/billing/testing";
import type { Entitlement } from "@softure-ai/billing";
import { createTestAccount } from "@softure-ai/auth/testing";
import { createTestClock } from "@softure-ai/core";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createAccount, createConfig, NOW, type BillingInput } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEED = 555;
const PASSWORD = "correct horse battery";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

interface StateRow {
  user_id: string;
  status: string;
  ends_at: Date | null;
  read_only_since: Date | null;
  read_only_reason: string | null;
  is_stored: boolean;
}

/** A small seeded generator (mulberry32), so a failure reproduces. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The columns the SQL surface carries for a TypeScript entitlement. */
function toRow(entitlement: Entitlement): Omit<StateRow, "user_id" | "is_stored"> {
  switch (entitlement.status) {
    case "trial":
    case "paid":
      return { status: entitlement.status, ends_at: entitlement.endsAt, read_only_since: null, read_only_reason: null };
    case "read_only":
      return { status: "read_only", ends_at: null, read_only_since: entitlement.since, read_only_reason: entitlement.reason };
  }
}

interface SqlBilling {
  readonly ctx: BillingContext & { readonly clock: ReturnType<typeof createTestClock> };
  readonly database: TestDatabase;
}

async function createSqlBilling(options: BillingInput, timezone: string): Promise<SqlBilling> {
  const config = { ...createConfig(options), timezone };
  const database = await createTestDatabase(config.modules);
  return { ctx: { db: database.db, clock: createTestClock(NOW), config }, database };
}

async function readStates(test: SqlBilling, asOf: Date): Promise<Map<string, StateRow>> {
  const result = await test.database.client.query<StateRow>(
    "SELECT user_id, status, ends_at, read_only_since, read_only_reason, is_stored FROM billing.entitlement_states($1, $2, $3, $4)",
    [asOf.toISOString(), ...getPolicyArguments(test)],
  );
  return new Map(result.rows.map((row) => [row.user_id, row]));
}

function getPolicyArguments(test: SqlBilling): [number, string, string | null] {
  const options = test.ctx.config.modules.find((module) => module.id === "billing")?.options as { trial: { days: number; startsAt?: string } };
  return [options.trial.days, test.ctx.config.timezone, options.trial.startsAt ?? null];
}

const POLICIES: readonly { readonly name: string; readonly options: BillingInput; readonly timezone: string }[] = [
  { name: "a 14-day trial in Warsaw", options: {}, timezone: "Europe/Warsaw" },
  { name: "a 10-day trial from trial.startsAt in New York", options: { trial: { days: 10, startsAt: "2026-11-01" } }, timezone: "America/New_York" },
  { name: "a 3-day trial where midnight is skipped (Santiago)", options: { trial: { days: 3 } }, timezone: "America/Santiago" },
  { name: "no trial in Kiritimati", options: { trial: { days: 0 } }, timezone: "Pacific/Kiritimati" },
];

describe("billing.entitlement_states", () => {
  let test: SqlBilling | undefined;
  afterEach(async () => {
    await test?.database.close();
    test = undefined;
  });

  for (const policy of POLICIES) {
    it(`agrees with getEntitlement under ${policy.name}`, async () => {
      const random = createRandom(SEED);
      const at = (days: number): Date => new Date(NOW.getTime() + Math.round(days * DAY_MS));
      const current = await createSqlBilling(policy.options, policy.timezone);
      test = current;

      // Accounts created across a year (DST changes included), around half with a row of their own.
      const ends: Date[] = [];
      const ids: string[] = [];
      for (let index = 0; index < 24; index += 1) {
        const account = await createTestAccount(current.ctx, { email: `account-${index}@example.com`, password: PASSWORD, createdAt: at(random() * 360 - 180) });
        const id = account.id;
        ids.push(id);
        if (random() < 0.5) continue;
        const trialEndsAt = at(random() * 200 - 100);
        const paidUntil = random() < 0.6 ? at(random() * 200 - 100) : null;
        const lifetime = random() < 0.15;
        await createTestEntitlement(current.ctx, { userId: id, trialEndsAt, paidUntil, lifetime });
        ends.push(trialEndsAt, ...(paidUntil === null ? [] : [paidUntil]));
      }
      for (const id of ids) {
        const entitlement = await getEntitlement(current.ctx, id);
        if (entitlement?.status === "trial") ends.push(entitlement.endsAt);
      }

      const instants = [...Array.from({ length: 6 }, () => at(random() * 400 - 200)), ...ends.flatMap((end) => [new Date(end.getTime() - 1), end])];
      for (const asOf of instants) {
        current.ctx.clock.set(asOf);
        const states = await readStates(current, asOf);
        expect(states.size).toBe(ids.length);
        for (const id of ids) {
          const entitlement = await getEntitlement(current.ctx, id);
          if (entitlement === null) throw new Error(`no entitlement for ${id}`);
          expect({ asOf, ...states.get(id) }).toMatchObject({ asOf, user_id: id, ...toRow(entitlement) });
        }
      }
    });
  }

  it("marks which accounts have a row", async () => {
    test = await createSqlBilling({}, "Europe/Warsaw");
    const bare = await createAccount(test, "bare@example.com");
    const stored = await createAccount(test, "stored@example.com");
    await createTestEntitlement(test.ctx, { userId: stored });
    const states = await readStates(test, NOW);
    expect(states.get(bare)?.is_stored).toBe(false);
    expect(states.get(stored)?.is_stored).toBe(true);
  });
});

describe("billing.entitlement_state", () => {
  let test: SqlBilling;
  afterEach(() => test.database.close());

  it("answers for one account, and with no row for an unknown id", async () => {
    test = await createSqlBilling({}, "Europe/Warsaw");
    const id = await createAccount(test, "ada@example.com");
    const query = "SELECT status, ends_at, is_lifetime, is_stored FROM billing.entitlement_state($1, $2, $3, $4)";
    const found = await test.database.client.query(query, [id, NOW.toISOString(), 14, "Europe/Warsaw"]);
    expect(found.rows).toEqual([{ status: "trial", ends_at: new Date("2026-10-16T22:00:00Z"), is_lifetime: false, is_stored: false }]);
    const missing = await test.database.client.query(query, [UNKNOWN_ID, NOW.toISOString(), 14, "Europe/Warsaw"]);
    expect(missing.rows).toEqual([]);
  });
});

describe("getEntitlementStatesSql", () => {
  let test: SqlBilling;
  afterEach(() => test.database.close());

  it("fills the app's trial policy and the clock, so a Drizzle query needs no copy of the configuration", async () => {
    test = await createSqlBilling({ trial: { days: 10, startsAt: "2026-11-01" } }, "America/New_York");
    const id = await createAccount(test, "ada@example.com");
    const query = async (asOf?: Date) => {
      const result = await test.ctx.db.execute<{ user_id: string; status: string; ends_at: string | null }>(
        sql`select s.user_id, s.status, s.ends_at::text from ${getEntitlementStatesSql(test.ctx, asOf)} s`,
      );
      // A raw query returns timestamptz as text.
      return result.rows.map((row) => ({ ...row, ends_at: row.ends_at === null ? null : new Date(row.ends_at) }));
    };
    // 1 to 10 November in New York (EST by then): it ends when 11 November begins.
    const trialEnd = new Date("2026-11-11T05:00:00Z");
    expect(await query()).toEqual([{ user_id: id, status: "trial", ends_at: trialEnd }]);
    expect(await query(trialEnd)).toEqual([{ user_id: id, status: "read_only", ends_at: null }]);
  });
});
