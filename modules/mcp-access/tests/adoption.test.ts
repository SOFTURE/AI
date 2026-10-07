// Adoption (README §5, docs/05-adoption-playbook.md): an app that ran its own MCP tokens and OAuth
// tables in `public`, with its own constraint and index names and defaults, moves them with
// adoption/move-app-tables.sql; adoptModule then finds no difference and records files 1 and 2 as
// adopted. Every row keeps working: a legacy token, a connected app and its legacy refresh token.
import { readFileSync } from "node:fs";
import { createTestDatabase, type TestDatabase } from "@softure-ai/db/testing";
import { adoptModule, createPgliteHandle, describeProblem } from "@softure-ai/db";
import { findOAuthClient, hashAccessToken, refreshOAuthGrant, verifyAccessToken } from "@softure-ai/mcp-access/server";
import { createTestClock } from "@softure-ai/core";
import { afterEach, describe, expect, it } from "vitest";
import { createConfig, createUser, NOW, OAUTH_OPTIONS } from "./support.js";

const ADOPTION_SQL = readFileSync(new URL("../adoption/move-app-tables.sql", import.meta.url), "utf8");
const DAY_MS = 86_400_000;

const LEGACY_ISSUED_VALUE = "0123456789abcdef".repeat(4);
const LEGACY_RENEWAL_VALUE = "fedcba9876543210".repeat(4);
const GRANT_ISSUED_VALUE = "00112233445566778899aabbccddeeff".repeat(2);
const LEGACY_CLIENT_ID = "a1b2c3d4-legacy-client";

// The adopting app's own DDL: drizzle-style names, defaults, no checks.
const APP_TABLES = `
  CREATE TABLE public.oauth_clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id text NOT NULL CONSTRAINT oauth_clients_client_id_unique UNIQUE,
    client_name text NOT NULL,
    redirect_uris jsonb NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    client_secret_hash text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.oauth_authorization_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash text NOT NULL CONSTRAINT oauth_authorization_codes_code_hash_unique UNIQUE,
    client_id uuid NOT NULL REFERENCES public.oauth_clients (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    can_write boolean NOT NULL DEFAULT false,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX oauth_authorization_codes_by_client ON public.oauth_authorization_codes (client_id);
  CREATE INDEX oauth_authorization_codes_by_user ON public.oauth_authorization_codes (user_id);
  CREATE TABLE public.oauth_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES public.oauth_clients (id) ON DELETE CASCADE,
    can_write boolean NOT NULL DEFAULT false,
    refresh_token_hash text NOT NULL CONSTRAINT oauth_grants_refresh_token_hash_unique UNIQUE,
    previous_refresh_token_hash text,
    refresh_expires_at timestamptz NOT NULL,
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX one_oauth_grant_per_client ON public.oauth_grants (user_id, client_id);
  CREATE INDEX oauth_grants_by_client ON public.oauth_grants (client_id);
  CREATE INDEX oauth_grants_by_previous_refresh ON public.oauth_grants (previous_refresh_token_hash);
  CREATE TABLE public.access_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    token_hash text NOT NULL CONSTRAINT access_tokens_token_hash_unique UNIQUE,
    name text NOT NULL,
    can_write boolean NOT NULL DEFAULT false,
    expires_at timestamptz NOT NULL,
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    grant_id uuid REFERENCES public.oauth_grants (id) ON DELETE CASCADE
  );
  CREATE INDEX access_tokens_by_user ON public.access_tokens (user_id);
  CREATE INDEX access_tokens_by_grant ON public.access_tokens (grant_id);
`;

const config = createConfig({ ...OAUTH_OPTIONS, legacyTokenPattern: /^[0-9a-f]{64}$/ });
const [securityModule, authModule] = config.modules;

describe("adopting an app's own MCP token and OAuth tables", () => {
  let database: TestDatabase | undefined;

  afterEach(async () => {
    await database?.close();
    database = undefined;
  });

  async function seedApp(): Promise<{ database: TestDatabase; userId: string; grantId: string }> {
    if (securityModule === undefined || authModule === undefined) throw new Error("config without security and auth");
    database = await createTestDatabase([securityModule, authModule]);
    const userId = await createUser(database, "ada@example.com");
    await database.client.exec(APP_TABLES);
    const later = new Date(NOW.getTime() + 30 * DAY_MS);
    const client = await database.client.query<{ id: string }>(
      `INSERT INTO public.oauth_clients (client_id, client_name, redirect_uris, token_endpoint_auth_method, created_at)
       VALUES ($1, $2, '["https://assistant.example/oauth/callback"]', 'none', $3) RETURNING id`,
      [LEGACY_CLIENT_ID, `  ${"A".repeat(80)}`, NOW],
    );
    const clientId = client.rows[0]?.id;
    const grant = await database.client.query<{ id: string }>(
      `INSERT INTO public.oauth_grants (user_id, client_id, can_write, refresh_token_hash, refresh_expires_at, created_at)
       VALUES ($1, $2, true, $3, $4, $5) RETURNING id`,
      [userId, clientId, hashAccessToken(LEGACY_RENEWAL_VALUE), later, NOW],
    );
    const grantId = grant.rows[0]?.id;
    if (grantId === undefined) throw new Error("seedApp: no grant id");
    await database.client.query(
      `INSERT INTO public.access_tokens (user_id, token_hash, name, can_write, expires_at, created_at, grant_id)
       VALUES ($1, $2, 'Laptop', true, $3, $4, NULL), ($1, $5, 'Assistant', true, $3, $4, $6)`,
      [userId, hashAccessToken(LEGACY_ISSUED_VALUE), later, NOW, hashAccessToken(GRANT_ISSUED_VALUE), grantId],
    );
    return { database, userId, grantId };
  }

  it("moves the tables, adopts files 1 and 2 with no difference and keeps every row working", async () => {
    const { database: seeded, userId, grantId } = await seedApp();
    await seeded.client.exec(ADOPTION_SQL);
    const handle = await createPgliteHandle(seeded.client);

    const result = await adoptModule(handle, { modules: config.modules, module: "mcp-access", version: "0.1.7" });

    expect(result.ok ? null : result.problems.map(describeProblem)).toBeNull();
    expect(result.ok && result.value.adopted.map((step) => [step.version, step.name])).toEqual([
      [1, "create_access_tokens"],
      [2, "create_oauth_grants"],
    ]);
    const clock = createTestClock(new Date(NOW.getTime() + DAY_MS));
    const ctx = { db: seeded.db, clock, config };
    expect(await verifyAccessToken(ctx, LEGACY_ISSUED_VALUE)).toMatchObject({ userId, canWrite: true, grantId: null });
    expect(await verifyAccessToken(ctx, GRANT_ISSUED_VALUE)).toMatchObject({ userId, grantId });
    const client = await findOAuthClient(ctx, LEGACY_CLIENT_ID);
    expect(client?.clientName).toBe("A".repeat(60));
    if (client === null) throw new Error("legacy client not found");
    const refreshed = await refreshOAuthGrant(ctx, { refreshToken: LEGACY_RENEWAL_VALUE, client });
    expect(refreshed?.canWrite).toBe(true);
    expect(refreshed?.refreshToken).toMatch(/^sftmcr_/);
  });

  it("leaves the app's tables in public when adoption finds a difference", async () => {
    const { database: seeded } = await seedApp();
    const handle = await createPgliteHandle(seeded.client);

    const result = await adoptModule(handle, { modules: config.modules, module: "mcp-access", version: "0.1.7" });

    expect(result.ok).toBe(false);
    const tables = await seeded.client.query<{ n: number }>("SELECT count(*)::int AS n FROM public.access_tokens");
    expect(tables.rows[0]?.n).toBe(2);
  });
});
