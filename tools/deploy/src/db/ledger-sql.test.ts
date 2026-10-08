import { describe, expect, it } from "vitest";
import { buildLedgerSql, buildRowCountsSql, parseLedgerOutput, parseRowCountsOutput } from "./ledger-sql.js";

const SOFTURE_ROW = { module: "notes", version: 1, name: "init", checksum: "a".repeat(64), method: "applied" };

describe("buildLedgerSql", () => {
  it("reads softure.migrations and, when asked, the app ledger, each as no rows while its table is absent", () => {
    const sql = buildLedgerSql("drizzle.__drizzle_migrations");
    expect(sql).toContain("SELECT to_regclass('softure.migrations') IS NOT NULL AS softure_ledger \\gset");
    expect(sql).toContain(`SELECT to_regclass('"drizzle"."__drizzle_migrations"') IS NOT NULL AS app_ledger \\gset`);
    expect(sql).toContain(`FROM "drizzle"."__drizzle_migrations" \\gset`);
    expect(sql.trimEnd().split("\n").at(-1)).toBe("SELECT json_build_object('softure', :'softure_rows'::json, 'app', :'app_rows'::json);");
    expect(buildLedgerSql(null)).not.toContain("app_ledger");
  });
});

describe("buildRowCountsSql", () => {
  it("names each table once as a key and once quoted for to_regclass, in order", () => {
    expect(buildRowCountsSql(["users", "billing.plans"])).toContain(
      `FROM unnest(ARRAY['users', 'billing.plans']::text[], ARRAY['"users"', '"billing"."plans"']::text[]) WITH ORDINALITY AS t(name, quoted, ord);`,
    );
  });
});

describe("parseLedgerOutput", () => {
  it("reads the last JSON line of psql's output, aligned or not, with the app rows as numbers", () => {
    const text = `NOTICE: something\n {"softure" : [${JSON.stringify(SOFTURE_ROW)}], "app" : [{"hash" : "h", "created_at" : "1700000000000"}]}\n(1 row)\n`;
    expect(parseLedgerOutput(text)).toEqual({ ok: true, value: { softure: [SOFTURE_ROW], app: [{ hash: "h", createdAt: 1700000000000 }] } });
    expect(parseLedgerOutput('{"softure":[]}')).toEqual({ ok: true, value: { softure: [], app: null } });
  });

  it("refuses an empty output, broken JSON and another shape", () => {
    expect(parseLedgerOutput("")).toEqual({ ok: false, problem: "it holds no JSON line (did psql run the --print-sql output?)" });
    expect(parseLedgerOutput("{oops")).toEqual({ ok: false, problem: "its JSON line is not valid JSON" });
    expect(parseLedgerOutput('{"users": 3}')).toMatchObject({ ok: false, problem: expect.stringContaining("it is not the ledger output") as unknown });
  });
});

describe("parseRowCountsOutput", () => {
  it("reads the counts of exactly the listed tables, absent ones as null", () => {
    expect(parseRowCountsOutput('{ "users" : 2, "billing.plans" : null }', ["users", "billing.plans"])).toEqual({
      ok: true,
      value: { users: 2, "billing.plans": null },
    });
  });

  it("refuses counts of other tables than the list, naming both sides", () => {
    expect(parseRowCountsOutput('{"users": 2, "orders": 1}', ["users", "notes"])).toEqual({
      ok: false,
      problem: "it counts other tables than the list (missing notes; not listed orders)",
    });
  });

  it("refuses a count that is not a whole number", () => {
    expect(parseRowCountsOutput('{"users": -1}', ["users"])).toMatchObject({ ok: false });
  });
});
