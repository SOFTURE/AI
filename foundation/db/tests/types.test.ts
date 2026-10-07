// Compile-time checks, run by `npm run typecheck`: an app database typed with its own schema fits what
// module functions take, so the app needs no casts to pass its database or a transaction to a module.
import type { Database, PgliteClientDatabase, PostgresDatabase, Queryable } from "@softure-ai/db";
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
