// Compile-time checks, run by `npm run typecheck`: an app database typed with its own schema fits what
// module functions take, so the app needs no casts to pass its database or a transaction to a module.
import type { Database, PgliteClientDatabase, PostgresDatabase, Queryable } from "@softure-ai/db";
import { eq, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { describe, expectTypeOf, it } from "vitest";

const appSchema = { notes: pgTable("notes", { id: text("id").primaryKey() }) };

describe("database types", () => {
  it("accepts an app database typed with its schema where a module takes Database or Queryable", () => {
    expectTypeOf(appSchema.notes.id.name).toBeString();
    expectTypeOf<PostgresDatabase<typeof appSchema>>().toExtend<Database>();
    expectTypeOf<PgliteClientDatabase<typeof appSchema>>().toExtend<Queryable>();
    type AppTransaction = Parameters<Parameters<PostgresDatabase<typeof appSchema>["transaction"]>[0]>[0];
    expectTypeOf<AppTransaction>().toExtend<Queryable>();
  });
});

describe("Queryable queries", () => {
  it("accepts a database of either driver and a transaction of either driver", () => {
    expectTypeOf<Database>().toExtend<Queryable>();
    type PgliteTransaction = Parameters<Parameters<PgliteClientDatabase<typeof appSchema>["transaction"]>[0]>[0];
    expectTypeOf<PgliteTransaction>().toExtend<Queryable>();
  });

  it("accepts a column selection in returning() on delete and update", () => {
    async function removeNote(db: Queryable, id: string): Promise<{ id: string }[]> {
      return db.delete(appSchema.notes).where(eq(appSchema.notes.id, id)).returning({ id: appSchema.notes.id });
    }
    async function renameNote(db: Queryable, id: string): Promise<{ id: string }[]> {
      return db.update(appSchema.notes).set({ id: `${id}-renamed` }).where(eq(appSchema.notes.id, id)).returning({ id: appSchema.notes.id });
    }
    expectTypeOf(removeNote).returns.resolves.toEqualTypeOf<{ id: string }[]>();
    expectTypeOf(renameNote).returns.resolves.toEqualTypeOf<{ id: string }[]>();
  });

  it("types the rows of execute()", () => {
    async function countNotes(db: Queryable): Promise<{ count: number }[]> {
      const result = await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM notes`);
      return result.rows;
    }
    expectTypeOf(countNotes).returns.resolves.toEqualTypeOf<{ count: number }[]>();
  });

  it("keeps the result fields both drivers report on execute()", () => {
    type ExecuteResult = Awaited<ReturnType<Queryable["execute"]>>;
    expectTypeOf<ExecuteResult["rowCount"]>().toEqualTypeOf<number | null | undefined>();
    expectTypeOf<ExecuteResult["command"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ExecuteResult["fields"][number]["name"]>().toEqualTypeOf<string>();
  });
});
