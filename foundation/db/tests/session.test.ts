import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createPgliteHandle, migrate } from "@softure-ai/db";
import { afterEach, describe, expect, it } from "vitest";
import { copyFixtureMigrations, createNotesModule } from "./fixtures/modules.js";
import { queryRows } from "./support/query.js";

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe("a migration run on a shared PGlite connection", () => {
  it("keeps the app's session settings and still undoes the run's own SET", async () => {
    const handle = await createPgliteHandle(new PGlite());
    cleanups.push(handle.close);
    await handle.client.exec("SET TimeZone = 'Europe/Warsaw'; SET search_path = public, pg_catalog;");
    const notes = copyFixtureMigrations("notes");
    cleanups.push(notes.cleanup);
    writeFileSync(join(notes.path, "0003_set_settings.sql"), "-- Rollback: nothing to undo.\nSET search_path TO notes;\nSET lock_timeout = '5s';\nRESET TimeZone;\n");

    const result = await migrate(handle, { modules: [createNotesModule(notes.dir)] });

    expect(result.ok).toBe(true);
    const [settings] = await queryRows<{ tz: string; path: string; lock: string }>(
      handle,
      "SELECT current_setting('TimeZone') AS tz, current_setting('search_path') AS path, current_setting('lock_timeout') AS lock",
    );
    expect(settings).toEqual({ tz: "Europe/Warsaw", path: "public, pg_catalog", lock: "0" });
  });
});
