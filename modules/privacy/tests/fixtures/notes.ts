// A module that stands in for any module holding user data: it depends on auth, keeps rows that
// reference auth.users with ON DELETE RESTRICT, and contributes its export and deletion.
import { defineModule, ok, resolveMigrationsDir, type ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { sql } from "drizzle-orm";

const db = (context: ModuleContext) => context.db as Queryable;

export const notes = defineModule({
  manifest: {
    id: "notes",
    version: "0.1.0",
    dependsOn: { auth: "^0.0.0" },
    dbSchema: "notes",
    tables: ["notes"],
    env: [],
    switches: [],
    routes: {},
    mount: [],
    privacy: { exports: true, deletes: true },
  },
  messages: { en: {}, pl: {} },
  migrations: { dir: resolveMigrationsDir(import.meta.url, "./notes-migrations/") },
  privacy: {
    exportUserData: async (context, userId) => {
      const result = await db(context).execute<{ body: string }>(sql`SELECT body FROM notes.notes WHERE user_id = ${userId} ORDER BY id`);
      return ok({ notes: result.rows.map((row) => row.body) });
    },
    deleteUserData: async (context, userId) => {
      await db(context).execute(sql`DELETE FROM notes.notes WHERE user_id = ${userId}`);
      return ok();
    },
  },
});
