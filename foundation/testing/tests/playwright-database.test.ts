import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabaseClient, withDatabase } from "@softure-ai/testing/playwright";

// node-postgres stands in for the integration database: each test scripts what the pool answers and reads what it
// was asked.
interface FakePool {
  config: unknown;
  calls: { statement: string; params: unknown[] }[];
  answer: (statement: string) => Promise<{ rows: unknown[] }>;
  errorListeners: number;
  ended: number;
}

const pool = vi.hoisted((): FakePool => ({ config: undefined, calls: [], answer: () => Promise.resolve({ rows: [] }), errorListeners: 0, ended: 0 }));

vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor(config: unknown) {
        pool.config = config;
      }
      query(statement: string, params: unknown[]): Promise<{ rows: unknown[] }> {
        pool.calls.push({ statement, params });
        return pool.answer(statement);
      }
      on(event: string): void {
        if (event === "error") pool.errorListeners += 1;
      }
      end(): Promise<void> {
        pool.ended += 1;
        return Promise.resolve();
      }
    },
  },
}));

const URL = "postgres://e2e:secret@localhost:5432/e2e";

beforeEach(() => {
  pool.config = undefined;
  pool.calls = [];
  pool.answer = () => Promise.resolve({ rows: [] });
  pool.errorListeners = 0;
  pool.ended = 0;
});

describe("createTestDatabaseClient", () => {
  it("opens a small pool on the URL with an error listener", async () => {
    await createTestDatabaseClient(URL);
    expect(pool.config).toEqual({ connectionString: URL, max: 2 });
    expect(pool.errorListeners).toBe(1);
    await createTestDatabaseClient(URL, { max: 5 });
    expect(pool.config).toEqual({ connectionString: URL, max: 5 });
  });

  it("refuses an empty URL", async () => {
    await expect(createTestDatabaseClient("")).rejects.toThrow("createTestDatabaseClient: the database URL is empty");
  });

  it("returns the rows of a statement run with its parameters", async () => {
    pool.answer = () => Promise.resolve({ rows: [{ id: 1, email: "ada@example.com" }] });
    const client = await createTestDatabaseClient(URL);
    await expect(client.query("SELECT id, email FROM auth.users WHERE email = $1", ["ada@example.com"])).resolves.toEqual([
      { id: 1, email: "ada@example.com" },
    ]);
    expect(pool.calls).toEqual([{ statement: "SELECT id, email FROM auth.users WHERE email = $1", params: ["ada@example.com"] }]);
  });

  it("names the statement when a query fails and keeps the driver error as the cause", async () => {
    const driverError = new Error('relation "auth.nope" does not exist');
    pool.answer = () => Promise.reject(driverError);
    const client = await createTestDatabaseClient(URL);
    const failure = await client.query("DELETE FROM auth.nope").then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("Test database query failed: DELETE FROM auth.nope");
    expect((failure as Error).cause).toBe(driverError);
  });

  it("counts rows with quoted identifiers, bound values and IS NULL for null", async () => {
    pool.answer = () => Promise.resolve({ rows: [{ count: 3 }] });
    const client = await createTestDatabaseClient(URL);
    await expect(client.countRows("auth.users", { email: "ada@example.com", deleted_at: null, is_active: true })).resolves.toBe(3);
    expect(pool.calls).toEqual([
      {
        statement: 'SELECT count(*)::int AS count FROM "auth"."users" WHERE "email" = $1 AND "deleted_at" IS NULL AND "is_active" = $2',
        params: ["ada@example.com", true],
      },
    ]);
  });

  it("counts every row of a table without a filter", async () => {
    pool.answer = () => Promise.resolve({ rows: [{ count: 0 }] });
    const client = await createTestDatabaseClient(URL);
    await expect(client.countRows("entries")).resolves.toBe(0);
    expect(pool.calls).toEqual([{ statement: 'SELECT count(*)::int AS count FROM "entries"', params: [] }]);
  });

  it("refuses a table or column that is not a plain identifier before running anything", async () => {
    const client = await createTestDatabaseClient(URL);
    await expect(client.countRows('users"; DROP TABLE users; --')).rejects.toThrow(RangeError);
    await expect(client.countRows("a.b.c")).rejects.toThrow('countRows: "a.b.c" is not a table name');
    await expect(client.countRows("users", { "email = email OR 1": 1 })).rejects.toThrow("is not a plain identifier");
    expect(pool.calls).toEqual([]);
  });

  it("ends the pool once however often it is closed, also through withDatabase", async () => {
    pool.answer = () => Promise.resolve({ rows: [{ count: 1 }] });
    const count = await withDatabase(
      () => createTestDatabaseClient(URL),
      (client) => client.countRows("entries", { message: "hello" }),
    );
    expect(count).toBe(1);
    expect(pool.ended).toBe(1);

    const client = await createTestDatabaseClient(URL);
    await client.close();
    await client.close();
    expect(pool.ended).toBe(2);
  });
});
