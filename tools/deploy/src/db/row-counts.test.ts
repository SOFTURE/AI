import { describe, expect, it } from "vitest";
import { compareRowCounts, parseTableList, rowCountsFileSchema } from "./row-counts.js";

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

describe("compareRowCounts", () => {
  it("passes tables that kept or gained rows", () => {
    expect(compareRowCounts({ users: 10, notes: 5 }, { users: 10, notes: 7 })).toEqual({
      changes: [
        { table: "users", before: 10, after: 10 },
        { table: "notes", before: 5, after: 7 },
      ],
      lost: [],
    });
  });

  it("flags a table that lost rows or was not counted before", () => {
    const { lost } = compareRowCounts({ users: 10 }, { users: 9, notes: 0 });
    expect(lost).toEqual([
      { table: "users", before: 10, after: 9 },
      { table: "notes", before: null, after: 0 },
    ]);
  });
});

describe("rowCountsFileSchema", () => {
  it("accepts the file --out writes and refuses negative or fractional counts", () => {
    expect(rowCountsFileSchema.safeParse({ takenAt: "2026-10-05T18:00:00.000Z", counts: { users: 3 } }).success).toBe(true);
    expect(rowCountsFileSchema.safeParse({ takenAt: "x", counts: { users: -1 } }).success).toBe(false);
    expect(rowCountsFileSchema.safeParse({ takenAt: "x", counts: { users: 1.5 } }).success).toBe(false);
    expect(rowCountsFileSchema.safeParse({ takenAt: "x", counts: {}, extra: 1 }).success).toBe(false);
  });
});
