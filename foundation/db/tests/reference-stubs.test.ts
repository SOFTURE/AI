// Adoption of a module whose SQL references app tables (issue #170): the reference schema is built
// on a scratch database that gets stubs of the app's tables, copied from the database being adopted.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { AnySoftureModule } from "@softure-ai/core";
import { adoptModule, migrate, type DatabaseHandle, type MigrationResult } from "@softure-ai/db";
import { createFixtureModule, createLinkedModule } from "./fixtures/modules.js";
import { createTestDrivers } from "./support/drivers.js";
import { execSql, queryRows, readLedger } from "./support/query.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

// The app's own history for the `linked` fixture: its users table stays in `public`, its links
// table moves into the module's schema. Idempotent, as an app's migrator is.
const APP_LINKED = `
  CREATE TABLE IF NOT EXISTS public.app_users (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL);
  CREATE SCHEMA IF NOT EXISTS linked;
  CREATE TABLE IF NOT EXISTS linked.links (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.app_users (id)
  );
`;

// An app schema besides `public`, an enum the module's data migration compares against, a unique
// index (no constraint) and a composite unique key as foreign key targets.
const APP_ORDERS = `
  CREATE SCHEMA app;
  CREATE TYPE app.account_status AS ENUM ('active', 'closed');
  CREATE TABLE app.accounts (id serial PRIMARY KEY, code text NOT NULL, status app.account_status NOT NULL DEFAULT 'active');
  CREATE UNIQUE INDEX accounts_code_idx ON app.accounts (code);
  CREATE TABLE public.plans (region text, tier text, price numeric, CONSTRAINT plans_region_tier_key UNIQUE (region, tier));
  INSERT INTO app.accounts (code) VALUES ('a-1');
  CREATE SCHEMA orders;
  CREATE TABLE orders.orders (
    id integer PRIMARY KEY,
    account_code text NOT NULL REFERENCES app.accounts (code),
    region text NOT NULL,
    tier text NOT NULL,
    CONSTRAINT orders_plan_fkey FOREIGN KEY (region, tier) REFERENCES public.plans (region, tier)
  );
`;

const ORDERS_SQL = `-- Rollback: DROP TABLE orders.orders;
CREATE TABLE orders (
  id integer PRIMARY KEY,
  account_code text NOT NULL REFERENCES app.accounts (code),
  region text NOT NULL,
  tier text NOT NULL,
  CONSTRAINT orders_plan_fkey FOREIGN KEY (region, tier) REFERENCES public.plans (region, tier)
);
INSERT INTO orders (id, account_code, region, tier)
  SELECT id, code, 'eu', 'basic' FROM app.accounts WHERE status = 'closed';
`;

// A column of a domain type: domains are not copied, so the stub drops that column.
const APP_MAIL = `
  CREATE DOMAIN public.email AS text CHECK (VALUE LIKE '%@%');
  CREATE TABLE public.app_users (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email public.email NOT NULL);
  CREATE TABLE public.mailboxes (address public.email PRIMARY KEY);
  CREATE SCHEMA linked;
  CREATE TABLE linked.links (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.app_users (id)
  );
  CREATE SCHEMA mail;
  CREATE TABLE mail.deliveries (address text NOT NULL REFERENCES public.mailboxes (address));
`;

const MAIL_SQL = `-- Rollback: DROP TABLE mail.deliveries;
CREATE TABLE deliveries (address text NOT NULL REFERENCES public.mailboxes (address));
`;

/** A module with one migration file, in a temporary folder. */
function createSqlModule(id: string, sql: string): AnySoftureModule {
  const root = mkdtempSync(join(tmpdir(), `softure-db-${id}-`));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, `0001_create_${id}.sql`), sql);
  return createFixtureModule({ id, migrationsDir: pathToFileURL(`${root}/`) });
}

function getProblem<T>(result: MigrationResult<T>) {
  if (result.ok) throw new Error("expected a failure");
  const [problem] = result.problems;
  if (problem === undefined) throw new Error("expected a problem");
  return problem;
}

function formatLedger(rows: readonly { module: string; version: number; method: string }[]): string[] {
  return rows.map((row) => `${row.module}/${row.version}/${row.method}`);
}

describe.each(createTestDrivers())("adopting a module that references app tables on $name", (driver) => {
  afterEach(() => driver.cleanup());

  async function openWith(sql: string): Promise<DatabaseHandle> {
    const handle = await driver.open();
    await execSql(handle, sql);
    return handle;
  }

  it("adopts a module whose foreign key points at an app table in public", async () => {
    const handle = await openWith(APP_LINKED);

    const result = await adoptModule(handle, { modules: [createLinkedModule()], module: "linked", version: "0.1.0" });

    expect(result.ok && result.value.adopted.map((step) => step.name)).toEqual(["create_links"]);
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied", "linked/1/adopted"]);
  });

  it("adopts it through a baseline after the app's before migrations, then has nothing to do", async () => {
    const handle = await driver.open();
    const app = { before: (received: DatabaseHandle) => execSql(received, APP_LINKED), baseline: { linked: 1 } };

    const first = await migrate(handle, { modules: [createLinkedModule()], app });
    const second = await migrate(handle, { modules: [createLinkedModule()], app });

    expect(first.ok && first.value).toMatchObject({ adopted: [{ module: "linked", version: 1 }], app: ["before"] });
    expect(second.ok && second.value).toMatchObject({ applied: [], adopted: [] });
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied", "linked/1/adopted"]);
  });

  it("still refuses a foreign key that differs from the module's", async () => {
    const handle = await openWith(APP_LINKED.replace("REFERENCES public.app_users (id)", "REFERENCES public.app_users (id) ON DELETE CASCADE"));

    const result = await adoptModule(handle, { modules: [createLinkedModule()], module: "linked", version: "0.1.0" });

    expect(getProblem(result)).toEqual({
      code: "db.schema_mismatch",
      module: "linked",
      schema: "linked",
      differences: [
        "missing in database: constraint linked.links.links_user_id_fkey: FOREIGN KEY (user_id) REFERENCES public.app_users(id)",
        "unexpected in database: constraint linked.links.links_user_id_fkey: FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE",
      ],
    });
  });

  it("copies app schemas besides public, enum columns, unique indexes and composite keys", async () => {
    const handle = await openWith(APP_ORDERS);

    const result = await adoptModule(handle, { modules: [createSqlModule("orders", ORDERS_SQL)], module: "orders", version: "0.1.0" });

    expect(result.ok ? [] : result.problems).toEqual([]);
    expect(formatLedger(await readLedger(handle))).toEqual(["softure/1/applied", "orders/1/adopted"]);
    expect(await queryRows(handle, "SELECT code, status::text FROM app.accounts")).toEqual([{ code: "a-1", status: "active" }]);
  });

  it("skips a column whose type is not copied and still adopts a module that does not need it", async () => {
    const handle = await openWith(APP_MAIL);

    const result = await adoptModule(handle, { modules: [createLinkedModule()], module: "linked", version: "0.1.0" });

    expect(result.ok ? [] : result.problems).toEqual([]);
  });

  it("names the skipped stub column when the module needs it", async () => {
    const handle = await openWith(APP_MAIL);

    const result = await adoptModule(handle, { modules: [createSqlModule("mail", MAIL_SQL)], module: "mail", version: "0.1.0" });

    const problem = getProblem(result);
    expect(problem.code).toBe("db.adopt_reference_failed");
    expect(problem.code === "db.adopt_reference_failed" && problem.reason).toMatch(
      /^mail create_mail: .*\(app table stubs skipped: public\.app_users\.email: .*; public\.mailboxes\.address: .*; public\.mailboxes\.mailboxes_pkey: .*\)$/,
    );
  });
});
