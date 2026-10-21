// Every declared provider account as the page and the app see it, with its health. Reads no secret.
import { and, eq, inArray } from "drizzle-orm";
import type { ConnectionStatus, ConnectionView } from "../contract.js";
import type { ProviderDefinition } from "../options.js";
import { accounts, type AccountRow } from "../schema.js";
import { getConnectionsOptions, getProviderLabel } from "./options.js";
import type { ConnectionsContext } from "./store.js";

/** One view per declared provider and account, in the order the app declared them. */
export async function listConnections(ctx: ConnectionsContext): Promise<ConnectionView[]> {
  const { providers } = getConnectionsOptions(ctx.config);
  if (providers.length === 0) return [];
  const rows = await ctx.db
    .select()
    .from(accounts)
    .where(inArray(accounts.provider, providers.map((provider) => provider.id)));
  const byKey = new Map(rows.map((row) => [`${row.provider}/${row.accountId}`, row]));
  const now = ctx.clock.now();
  return providers.flatMap((provider) =>
    provider.accounts.map((accountId) => toView(ctx, provider, accountId, byKey.get(`${provider.id}/${accountId}`), now)),
  );
}

/** The view of one provider account. */
export async function getConnection(ctx: ConnectionsContext, provider: ProviderDefinition, accountId: string): Promise<ConnectionView> {
  const [row] = await ctx.db
    .select()
    .from(accounts)
    .where(and(eq(accounts.provider, provider.id), eq(accounts.accountId, accountId)));
  return toView(ctx, provider, accountId, row, ctx.clock.now());
}

function toView(ctx: ConnectionsContext, provider: ProviderDefinition, accountId: string, row: AccountRow | undefined, now: Date): ConnectionView {
  return {
    provider: provider.id,
    accountId,
    kind: provider.kind,
    label: getProviderLabel(ctx.config, provider),
    status: row === undefined ? "not_connected" : getStatus(ctx, row, now),
    scopes: row?.scopes ?? [],
    expiresAt: row?.expiresAt ?? null,
    refreshExpiresAt: row?.refreshExpiresAt ?? null,
    connectedAt: row?.connectedAt ?? null,
    connectedBy: row?.connectedBy ?? null,
    refreshedAt: row?.refreshedAt ?? null,
    lastError: row?.lastError ?? null,
    lastErrorAt: row?.lastErrorAt ?? null,
  };
}

/**
 * A stored connection's health. The grant dies with its refresh token, or with its access token when it has no
 * refresh token: past that moment it needs a reconnect, within `expiringWithinHours` of it it is expiring.
 */
export function getStatus(ctx: ConnectionsContext, row: AccountRow, now: Date): Exclude<ConnectionStatus, "not_connected"> {
  if (row.status === "reconnect_required") return "reconnect_required";
  const deadline = row.hasRefreshToken ? row.refreshExpiresAt : row.expiresAt;
  if (deadline === null) return "connected";
  const remaining = deadline.getTime() - now.getTime();
  if (remaining <= 0) return "reconnect_required";
  return remaining <= getConnectionsOptions(ctx.config).expiringWithinHours * 3_600_000 ? "expiring" : "connected";
}
