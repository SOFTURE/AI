import { sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase, findDriverError, isConstraintViolation, type DatabaseHandle } from "@softure-ai/db";

const items = pgTable("items", { slug: text("slug").notNull() });

const openHandles: DatabaseHandle[] = [];

afterEach(async () => {
  for (const handle of openHandles.splice(0)) await handle.close();
});

async function openItems(): Promise<DatabaseHandle> {
  const handle = await createDatabase("pglite://");
  openHandles.push(handle);
  await handle.db.execute(sql`create table items (slug text not null constraint items_slug_key unique)`);
  return handle;
}

/** The error a drizzle insert of a duplicate slug rejects with: the driver error wrapped as `cause`. */
async function insertDuplicate(handle: DatabaseHandle): Promise<unknown> {
  await handle.db.insert(items).values({ slug: "a" });
  return handle.db
    .insert(items)
    .values({ slug: "a" })
    .then(() => undefined, (error: unknown) => error);
}

describe("findDriverError", () => {
  it("finds the SQLSTATE, constraint and message under drizzle's wrapper", async () => {
    const error = await insertDuplicate(await openItems());

    expect(error).toBeInstanceOf(Error);
    expect(findDriverError(error)).toEqual({
      code: "23505",
      constraint: "items_slug_key",
      message: 'duplicate key value violates unique constraint "items_slug_key"',
    });
  });

  it("reads a driver error passed directly, without a constraint", () => {
    const error = Object.assign(new Error("division by zero"), { code: "22012" });

    expect(findDriverError(error)).toEqual({ code: "22012", constraint: undefined, message: "division by zero" });
  });

  it("returns undefined for an error without a code, a non-error value and a code that is not a string", () => {
    expect(findDriverError(new Error("plain", { cause: new Error("also plain") }))).toBeUndefined();
    expect(findDriverError("23505")).toBeUndefined();
    expect(findDriverError(undefined)).toBeUndefined();
    expect(findDriverError(Object.assign(new Error("numeric"), { code: 23505 }))).toBeUndefined();
  });
});

describe("isConstraintViolation", () => {
  it("is true for the code and the constraint of a duplicate insert", async () => {
    const error = await insertDuplicate(await openItems());

    expect(isConstraintViolation(error, { code: "23505", constraint: "items_slug_key" })).toBe(true);
    expect(isConstraintViolation(error, { code: "23505" })).toBe(true);
  });

  it("is false for another constraint, another code and an error that is not a driver error", async () => {
    const error = await insertDuplicate(await openItems());

    expect(isConstraintViolation(error, { code: "23505", constraint: "items_title_key" })).toBe(false);
    expect(isConstraintViolation(error, { code: "23503", constraint: "items_slug_key" })).toBe(false);
    expect(isConstraintViolation(new Error("network down"), { code: "23505" })).toBe(false);
  });
});
