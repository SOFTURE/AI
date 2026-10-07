// The README's recipe for adopting an existing switches table (§5), run as written: an app's own
// history creates a legacy table, the recipe moves it into the module's shape, and `migrate` adopts
// file 0001 through the app's baseline. The SQL is read from the README, so the two cannot drift.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppMigrations, DatabaseHandle } from "@softure-ai/db";
import { createTestDatabase } from "@softure-ai/db/testing";
import { describe, expect, it } from "vitest";
import { createConfig, listRows } from "./support.js";

const README = readFileSync(join(import.meta.dirname, "../README.md"), "utf8");

/** The first ```sql block after `heading`. */
function readSqlBlock(heading: string): string {
  const section = README.slice(README.indexOf(heading));
  const match = /```sql\n([\s\S]*?)```/.exec(section);
  if (!README.includes(heading) || match?.[1] === undefined) throw new Error(`README: no sql block under "${heading}"`);
  return match[1];
}

const RECIPE = readSqlBlock("### Adopting an existing switches table");
const RENAME_PKEY = "ALTER TABLE features.switches RENAME CONSTRAINT feature_switches_pkey TO switches_pkey;\n";

// The app's table before it adopted the module, with one row the recipe renames, one it keeps and
// one whose name no declared switch can have.
const LEGACY_TABLE = `
  CREATE TABLE public.feature_switches (
    name text PRIMARY KEY,
    enabled boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO public.feature_switches (name, enabled, updated_at) VALUES
    ('registration_closed', true, '2026-09-01T10:00:00Z'),
    ('billing.checkout_enabled', true, '2026-09-02T10:00:00Z'),
    ('Old Banner', false, '2026-09-03T10:00:00Z');
`;

async function execSql(handle: DatabaseHandle, sql: string): Promise<void> {
  if (handle.kind !== "pglite") throw new Error("test: the adoption test runs on PGlite");
  await handle.client.exec(sql);
}

// Hooks at module level: createTestDatabase caches its template per hook object.
const ADOPTING_APP: AppMigrations = {
  before: (handle) => execSql(handle, LEGACY_TABLE + RECIPE),
  baseline: { "feature-switches": 1 },
};
const APP_WITHOUT_PKEY_RENAME: AppMigrations = {
  before: (handle) => execSql(handle, LEGACY_TABLE + RECIPE.replace(RENAME_PKEY, "")),
  baseline: { "feature-switches": 1 },
};

describe("adopting an existing switches table with the README recipe", () => {
  it("adopts file 0001 through the baseline and keeps the stored switches under their new names", async () => {
    const database = await createTestDatabase(createConfig().modules, { app: ADOPTING_APP });
    try {
      const ledger = await database.client.query<{ version: number; method: string }>(
        "SELECT version, method FROM softure.migrations WHERE module = 'feature-switches' ORDER BY version",
      );
      expect(ledger.rows).toEqual([{ version: 1, method: "adopted" }]);
      expect(await listRows(database)).toEqual(["auth.registration_closed true null", "billing.checkout_enabled true null"]);
    } finally {
      await database.close();
    }
  });

  it("is refused by the baseline comparison without the primary key rename", async () => {
    expect(RECIPE).toContain(RENAME_PKEY);
    await expect(createTestDatabase(createConfig().modules, { app: APP_WITHOUT_PKEY_RENAME })).rejects.toThrow(/feature_switches_pkey|switches_pkey/);
  });
});
