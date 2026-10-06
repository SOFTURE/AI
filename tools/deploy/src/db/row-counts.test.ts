import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compareRowCounts, countRows, formatRowCountChange, formatRowCountLoss, parseTableList, rowCountsFileSchema } from "./row-counts.js";

describe("parseTableList", () => {
  it("takes tables and schema-qualified tables, trimmed and unique, in the given order", () => {
    expect(parseTableList(" users, billing.subscriptions ,users,")).toEqual({ ok: true, tables: ["users", "billing.subscriptions"] });
  });

  it("refuses an empty list and names that are not plain identifiers", () => {
    expect(parseTableList(" , ")).toEqual({ ok: false, problem: "no table given; pass --tables=users,billing.subscriptions" });
    expect(parseTableList('users,"Users",a.b.c,x;drop')).toEqual({
      ok: false,
      problem: 'not a table name (table or schema.table, lower snake case): "Users", a.b.c, x;drop',
    });
  });
});

describe("countRows", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE users (id int);
      INSERT INTO users VALUES (1), (2);
      CREATE SCHEMA billing;
      CREATE TABLE billing.subscriptions (id int);
      INSERT INTO billing.subscriptions VALUES (1), (2), (3);
    `);
  });

  afterEach(async () => {
    await database.close();
  });

  it("counts the tables that exist and marks the ones the database lacks as absent, in the list order", async () => {
    const counts = await countRows(database, ["notes", "users", "billing.absent", "billing.subscriptions", "ledger.entries"]);
    expect(Object.entries(counts)).toEqual([
      ["notes", null],
      ["users", 2],
      ["billing.absent", null],
      ["billing.subscriptions", 3],
      ["ledger.entries", null],
    ]);
  });

  it("counts an empty table as 0, not as absent", async () => {
    await database.exec("CREATE TABLE notes (id int);");
    expect(await countRows(database, ["notes"])).toEqual({ notes: 0 });
  });
});

describe("compareRowCounts", () => {
  it("passes tables that kept or gained rows", () => {
    expect(compareRowCounts({ users: 10, notes: 5 }, { users: 10, notes: 7 })).toEqual({
      changes: [
        { kind: "counted", table: "users", before: 10, after: 10 },
        { kind: "counted", table: "notes", before: 5, after: 7 },
      ],
      lost: [],
    });
  });

  it("passes a table the release created: absent before, counted after", () => {
    expect(compareRowCounts({ users: 10, notes: null }, { users: 10, notes: 0 })).toEqual({
      changes: [
        { kind: "counted", table: "users", before: 10, after: 10 },
        { kind: "new", table: "notes", after: 0 },
      ],
      lost: [],
    });
  });

  it("flags a table that lost rows, was not counted before, or is absent after the deploy", () => {
    const { changes, lost } = compareRowCounts(
      { users: 10, notes: 4, drafts: null },
      { users: 9, notes: null, drafts: null, invoices: 0 },
    );
    const expected = [
      { kind: "counted", table: "users", before: 10, after: 9 },
      { kind: "absent", table: "notes", before: 4 },
      { kind: "absent", table: "drafts", before: null },
      { kind: "uncounted", table: "invoices", after: 0 },
    ];
    expect(changes).toEqual(expected);
    expect(lost).toEqual(expected);
  });

  it("flags a table absent after the deploy that the earlier file never listed", () => {
    expect(compareRowCounts({}, { notes: null }).lost).toEqual([{ kind: "absent", table: "notes", before: null }]);
  });
});

describe("formatRowCountChange and formatRowCountLoss", () => {
  it("prints each kind of table on one line and names the reason of a failing one", () => {
    const { changes } = compareRowCounts(
      { users: 10, notes: 4, drafts: null, orders: 3 },
      { users: 9, notes: null, drafts: 2, orders: 5, invoices: 0 },
    );
    expect(changes.map(formatRowCountChange)).toEqual([
      "users 10 -> 9 (-1)",
      "notes 4 -> absent",
      "drafts absent -> 2 (created by this release)",
      "orders 3 -> 5 (+2)",
      "invoices 0 (not counted before)",
    ]);
    expect(compareRowCounts({ users: 10, notes: 4 }, { users: 9, notes: null, invoices: 0 }).lost.map(formatRowCountLoss)).toEqual([
      "users (fewer rows than before)",
      "notes (absent after the deploy)",
      "invoices (not counted before)",
    ]);
    expect(formatRowCountChange({ kind: "absent", table: "drafts", before: null })).toBe("drafts absent -> absent");
    expect(formatRowCountChange({ kind: "counted", table: "users", before: 4, after: 4 })).toBe("users 4 -> 4 (0)");
  });
});

describe("rowCountsFileSchema", () => {
  it("accepts the file --out writes, absent tables included, and refuses negative or fractional counts", () => {
    expect(rowCountsFileSchema.safeParse({ takenAt: "2026-10-05T18:00:00.000Z", counts: { users: 3 } }).success).toBe(true);
    expect(rowCountsFileSchema.safeParse({ takenAt: "2026-10-05T18:00:00.000Z", counts: { users: 3, notes: null } }).success).toBe(true);
    expect(rowCountsFileSchema.safeParse({ takenAt: "x", counts: { users: -1 } }).success).toBe(false);
    expect(rowCountsFileSchema.safeParse({ takenAt: "x", counts: { users: 1.5 } }).success).toBe(false);
    expect(rowCountsFileSchema.safeParse({ takenAt: "x", counts: { users: "absent" } }).success).toBe(false);
    expect(rowCountsFileSchema.safeParse({ takenAt: "x", counts: {}, extra: 1 }).success).toBe(false);
  });
});
